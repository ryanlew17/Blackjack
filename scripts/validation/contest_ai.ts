// @req REQ-2026-028: reproducible full matches through real commands, not patched state.
// Run: node_modules/.bin/esbuild scripts/validation/contest_ai.ts --bundle --platform=node --format=esm --outfile=/tmp/contest-ai.mjs
//      node /tmp/contest-ai.mjs > output/contest-ai.json
// Computation sums active slices; latency includes timer yields; match duration excludes UI replay/thinking.
// Optional P7_SEEDS=1,2 P7_OPPONENT=search (default baseline); no gameplay caps.
import {
  createMatch,
  transitionMatch,
  projectMatchTransition,
  legalMatchActions,
} from "../../src/domain/contest/engine";
import type { MatchCommand } from "../../src/domain/contest/engine";
import { S2_DEVELOPMENT_PRESET } from "../../src/domain/contest/presets/s2";
import { availableSkillIds } from "../../src/domain/contest/skills/catalog";
import { selectMatchSkills } from "../../src/domain/contest/skills/selection";
import { seededRandom } from "../../src/domain/contest/random";
import {
  createBeliefMemory,
  advanceBeliefMemory,
} from "../../src/domain/contest/ai/memory";
import {
  searchDecisionSteps,
  SEARCH_BUDGET,
} from "../../src/domain/contest/ai/search";
import { baselinePolicy } from "../../src/domain/contest/ai/policy";
import { SEARCH_SLICE } from "../../src/application/contest/decision";
import { writeFileSync } from "node:fs";
import { platform, arch, cpus, release } from "node:os";

const seeds = (
  process.env.P7_SEEDS ?? Array.from({ length: 20 }, (_, i) => i + 1).join(",")
)
  .split(",")
  .map(Number);
const opponent = process.env.P7_OPPONENT ?? "baseline";
const timings: number[] = [],
  latencies: number[] = [],
  slices: number[] = [],
  stats: Record<string, number> = {};
async function decide(
  memory: ReturnType<typeof createBeliefMemory>,
  seed: number,
) {
  const iterator = searchDecisionSteps(memory, seed);
  let result: ReturnType<typeof iterator.next>;
  const started = performance.now();
  let computation = 0;
  do {
    const slice = performance.now();
    let n = 0;
    do {
      result = iterator.next();
      n++;
    } while (
      !result.done &&
      n < SEARCH_SLICE.steps &&
      performance.now() - slice < SEARCH_SLICE.milliseconds
    );
    const elapsed = performance.now() - slice;
    slices.push(elapsed);
    computation += elapsed;
    if (!result.done)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
  } while (!result.done);
  timings.push(computation);
  latencies.push(performance.now() - started);
  for (const [k, v] of Object.entries(result.value.stats))
    stats[k] = (stats[k] ?? 0) + v;
  return result.value.command!;
}
const matches = [];
for (const seed of seeds) {
  const searchPlayer = seed % 2 ? "human" : "ai";
  const random = {
    numbers: seededRandom(seed * 10),
    trumpGate: seededRandom(seed * 10 + 1),
    trumpSelection: seededRandom(seed * 10 + 2),
    skillSelection: seededRandom(seed * 10 + 3),
    skillEffects: seededRandom(seed * 10 + 4),
  };
  const searchRandom = seededRandom(seed * 10 + 5);
  const available = availableSkillIds("standard", ["standard"]);
  const human =
    available[Math.floor(random.skillSelection() * available.length)];
  const skills = selectMatchSkills(
    "standard",
    ["standard"],
    human,
    random.skillSelection,
  );
  let result = createMatch(random, { ...S2_DEVELOPMENT_PRESET.round, skills });
  const first = result.state.round.firstPlayer;
  let memory = {
    human: createBeliefMemory(projectMatchTransition(result, "human")),
    ai: createBeliefMemory(projectMatchTransition(result, "ai")),
  };
  const points = { human: 0, ai: 0 },
    activations = { human: 0, ai: 0 };
  let commands = 0,
    trumps = 0,
    generatedNumbers = 0,
    generatedTrumps = 0,
    emptyStock = 0,
    chain = 0;
  const chains: number[] = [];
  const started = performance.now();
  const submit = (command: MatchCommand) => {
    const previous = result.state;
    const next = transitionMatch(previous, command, random);
    if (next.state === previous)
      throw Error(
        `Rejected seed=${seed} command=${commands} ${JSON.stringify(command)}`,
      );
    result = next;
    commands++;
    if (command.type === "PlayTrump") {
      chain++;
      trumps++;
    }
    if (command.type === "ActivateSkill") activations[command.player]++;
    if (
      previous.round.turn?.number !== next.state.round.turn?.number ||
      command.type === "NextRound" ||
      next.state.phase !== "playing"
    ) {
      if (chain) chains.push(chain);
      chain = 0;
    }
    for (const event of next.events) {
      if (event.type === "round") {
        const e = event.event;
        if (e.type === "trump" && e.effect === "generated-number")
          generatedNumbers++;
        if (e.type === "resource" && e.operation === "generate")
          generatedTrumps++;
        if (
          e.type === "resource" &&
          e.operation === "draw" &&
          !e.instance &&
          e.state.trumps!.stock[e.player].length === 0
        )
          emptyStock++;
      }
    }
    if (
      previous.phase === "playing" &&
      (next.state.phase === "round-complete" ||
        next.state.phase === "game-complete" ||
        next.state.phase === "complete")
    ) {
      points.human += next.state.game.points.human - previous.game.points.human;
      points.ai += next.state.game.points.ai - previous.game.points.ai;
    }
    for (const p of ["human", "ai"] as const)
      memory[p] = advanceBeliefMemory(
        memory[p],
        projectMatchTransition(next, p),
      );
  };
  while (result.state.phase !== "complete") {
    const state = result.state;
    if (state.phase !== "playing") {
      submit({ type: "NextRound", roundNumber: state.roundNumber });
      continue;
    }
    const reaction = memory.human.observation.round.reaction;
    const player = reaction?.player ?? state.round.turn!.player;
    let command: MatchCommand;
    if (!reaction && state.round.turn?.controlledBy)
      command = {
        type: "ResolveForcedTurn",
        player,
        turnNumber: state.round.turn.number,
        roundNumber: state.roundNumber,
      };
    else if (player === searchPlayer || opponent === "search") {
      try {
        command = await decide(
          memory[player],
          Math.floor(searchRandom() * 0x100000000),
        );
      } catch (error) {
        writeFileSync("output/p7-failure.json", JSON.stringify(memory[player]));
        throw new Error(`seed=${seed}, command=${commands}, player=${player}`, {
          cause: error,
        });
      }
    } else if (reaction)
      command = {
        type: "PassReaction",
        player,
        turnNumber: reaction.turnNumber,
        reactionBoundary: reaction.boundary,
        roundNumber: state.roundNumber,
      };
    else
      command = {
        type: baselinePolicy(
          memory[player].observation,
          legalMatchActions(memory[player].observation).filter(
            (a): a is "Hit" | "Stay" => a === "Hit" || a === "Stay",
          ),
        ),
        player,
        roundNumber: state.roundNumber,
      };
    submit(command);
    if (command.type === "ActivateSkill" && command.skillId === "twin-bloom")
      submit({
        type: "PassReaction",
        player,
        turnNumber: command.turnNumber,
        reactionBoundary: command.reactionBoundary!,
        roundNumber: state.roundNumber,
      });
  }
  const record = {
    seed,
    searchPlayer,
    first,
    skills: skills.selected,
    winner: result.state.winner,
    wins: result.state.wins,
    points,
    rounds: result.state.roundNumber,
    commands,
    trumps,
    chains: chains.length,
    chainMean: chains.reduce((a, b) => a + b, 0) / (chains.length || 1),
    chainMax: Math.max(0, ...chains),
    activations,
    remaining: {
      human: result.state.round.skills?.players.human.remainingUses,
      ai: result.state.round.skills?.players.ai.remainingUses,
    },
    generatedNumbers,
    generatedTrumps,
    emptyStock,
    ms: performance.now() - started,
  };
  console.error(JSON.stringify(record));
  matches.push(record);
}
const quantiles = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b),
    q = (p: number) => sorted[Math.ceil(p * sorted.length) - 1] ?? 0;
  return { count: sorted.length, p50: q(0.5), p95: q(0.95), max: q(1) };
};
console.log(
  JSON.stringify(
    {
      environment: {
        node: process.version,
        platform: platform(),
        release: release(),
        arch: arch(),
        cpu: cpus()[0]?.model,
      },
      budget: SEARCH_BUDGET,
      opponent,
      matches,
      timing: quantiles(timings),
      latency: quantiles(latencies),
      slices: quantiles(slices),
      stats,
    },
    null,
    2,
  ),
);
