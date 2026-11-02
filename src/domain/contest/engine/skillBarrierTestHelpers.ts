// @req REQ-2026-027: isolated real-command fixtures; no patched authority or production entry.
import type { PlayerId, NumberValue } from "../types";
import type { SkillId } from "../skills/catalog";
import { NUMBER_TRUMP_DEFINITIONS } from "../trumps/numberDefinitions";
import { INTERACTION_TRUMP_DEFINITIONS } from "../trumps/interactionDefinitions";
import { SKILL_TRUMP_DEFINITIONS } from "../trumps/skillDefinitions";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  legalSkillCommands,
  legalTrumpCommands,
} from "./index";
import type {
  MatchState,
  MatchTransition,
  RoundRules,
  MatchCommand,
} from "./index";
import { fixedRandom } from "./testHelpers";
export interface BarrierFixtureOptions {
  human?: SkillId;
  ai?: SkillId;
  first?: PlayerId;
  humanTrumps?: readonly string[];
  aiTrumps?: readonly string[];
  prefix?: readonly NumberValue[];
  stock?: Readonly<Record<string, number>>;
  effects?: readonly number[];
  gates?: readonly number[];
}
export function fixturePorts(options: BarrierFixtureOptions = {}) {
  const first = options.first ?? "human",
    numbers = [first === "human" ? 0.25 : 0.75];
  const effects = [...(options.effects ?? [])],
    gates = [...(options.gates ?? [])],
    selections: number[] = [];
  const calls = {
    numbers: 0,
    trumpGate: 0,
    trumpSelection: 0,
    skillEffects: 0,
    skillSelection: 0,
  };
  const addRound = (prefix: readonly NumberValue[] = [10, 8, 11, 9]) => {
    const source = fixedRandom(prefix);
    for (let n = 0; n < 10; n++) numbers.push(source());
  };
  addRound(options.prefix);
  const random = {
    numbers: () => {
      calls.numbers++;
      if (!numbers.length) throw new Error("Unplanned shuffle");
      return numbers.shift()!;
    },
    trumpGate: () => {
      calls.trumpGate++;
      return gates.shift() ?? 0.99;
    },
    trumpSelection: () => {
      calls.trumpSelection++;
      return selections.shift() ?? 0;
    },
    skillEffects: () => {
      calls.skillEffects++;
      return effects.shift() ?? 0;
    },
    skillSelection: () => {
      calls.skillSelection++;
      throw new Error("Unexpected selection RNG");
    },
  };
  const rules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "nightmare",
      playableDifficulties: ["nightmare"],
      selected: {
        human: options.human ?? "nullify",
        ai: options.ai ?? "spirit-sight",
      },
    },
    trumps: {
      tableCapacity: 5,
      definitions: {
        ...NUMBER_TRUMP_DEFINITIONS,
        ...INTERACTION_TRUMP_DEFINITIONS,
        ...SKILL_TRUMP_DEFINITIONS,
        noop: { onPlay: [] },
        "gen-one": { onPlay: [{ type: "generate-number", value: 1 }] },
        "gen-hand": {
          onPlay: [{ type: "generate-trump", definitionId: "noop" }],
        },
        "fill-hand": {
          onPlay: [{ type: "grant-trumps", target: "self", count: 7 }],
        },
        "grant-one": {
          onPlay: [{ type: "grant-trumps", target: "self", count: 1 }],
        },
        "delete-self": {
          onPlay: [{ type: "delete-last-number", target: "self" }],
        },
      },
      ...(options.stock
        ? {
            resources: {
              difficulty: "nightmare",
              handLimit: 8,
              gameGrant: 2,
              roundGrant: 1,
              hitProbability: 0.6,
              stock: options.stock,
            },
          }
        : {}),
    },
  };
  const human = options.humanTrumps ?? [],
    ai = options.aiTrumps ?? [];
  if (options.stock) {
    if (human.length !== 3 || ai.length !== 3)
      throw new Error("Plan three resource grants per side");
    const inventory = Object.entries(options.stock).flatMap(([id, n]) =>
      Array<string>(n).fill(id),
    );
    const remaining = { human: [...inventory], ai: [...inventory] },
      other = first === "human" ? "ai" : "human";
    for (const [player, index] of [
      [first, 0],
      [first, 1],
      [other, 0],
      [other, 1],
      [first, 2],
      [other, 2],
    ] as const) {
      const region = remaining[player],
        at = region.indexOf((player === "human" ? human : ai)[index]);
      if (at < 0) throw new Error("Missing planned initial grant");
      selections.push((at + 0.5) / region.length);
      region.splice(at, 1);
    }
  }
  const trumpSetup = options.stock
    ? undefined
    : {
        human: human.map((id, n) => ({
          instanceId: "h-" + n,
          definitionId: id,
        })),
        ai: ai.map((id, n) => ({ instanceId: "a-" + n, definitionId: id })),
      };
  return {
    rules,
    roundRules: rules,
    trumpSetup,
    random,
    calls,
    addRound,
    addMatch: () => {
      numbers.push(first === "human" ? 0.25 : 0.75);
      addRound(options.prefix);
    },
    addEffects: (...values: number[]) => effects.push(...values),
    addSelections: (...values: number[]) => selections.push(...values),
  };
}
export function fixture(options: BarrierFixtureOptions = {}) {
  const ports = fixturePorts(options);
  return {
    ...ports,
    state: createMatch(ports.random, ports.rules, ports.trumpSetup).state,
  };
}
export type BarrierRandom = ReturnType<typeof fixturePorts>["random"];
export function pass(state: MatchState, random: BarrierRandom): MatchState {
  const r = observeMatch(state, "human").round.reaction;
  return r
    ? transitionMatch(
        state,
        {
          type: "PassReaction",
          player: r.player,
          turnNumber: r.turnNumber,
          reactionBoundary: r.boundary,
          roundNumber: state.roundNumber,
        },
        random,
      ).state
    : state;
}
export function act(
  state: MatchState,
  type: "Stay" | "Hit",
  random: BarrierRandom,
): MatchTransition {
  state = pass(state, random);
  const result = transitionMatch(
    state,
    { type, player: state.round.turn!.player, roundNumber: state.roundNumber },
    random,
  );
  if (result.state === state) throw new Error("Illegal fixture action " + type);
  return result;
}
export function skill(
  state: MatchState,
  player: PlayerId,
  random: BarrierRandom,
): MatchTransition {
  if (state.rules.round.skills!.selected[player] !== "twin-bloom")
    state = pass(state, random);
  const command = legalSkillCommands(observeMatch(state, player).round)[0];
  if (!command) throw new Error("No fixture skill command " + player);
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
}
export function play(
  state: MatchState,
  id: string,
  random: BarrierRandom,
  choice: Partial<Extract<MatchCommand, { type: "PlayTrump" }>> = {},
): MatchTransition {
  state = pass(state, random);
  const player = state.round.turn!.player;
  const card = state.round.trumps!.hands[player].find(
    (c) => c.definitionId === id,
  );
  const commands = legalTrumpCommands(observeMatch(state, player).round).filter(
    (c) => c.instanceId === card?.instanceId,
  );
  const command = commands.find(
    (c) =>
      (!choice.targetId || c.targetId === choice.targetId) &&
      (!choice.definitionId || c.definitionId === choice.definitionId),
  )!;
  if (!command) throw new Error("No fixture play " + id);
  return transitionMatch(
    state,
    { ...command, ...choice, roundNumber: state.roundNumber },
    random,
  );
}
export function finish(state: MatchState, random: BarrierRandom): MatchState {
  for (let n = 0; n < 6 && state.phase === "playing"; n++)
    state = act(state, "Stay", random).state;
  if (state.phase === "playing") throw new Error("Fixture failed to settle");
  return state;
}
export function assertBarrierLedger(result: MatchTransition): void {
  for (const s of [result.state, ...result.events.map((e) => e.state)]) {
    const r = s.round,
      t = r.trumps!;
    const numbers = [
      ...r.deck,
      ...r.hands.human,
      ...r.hands.ai,
      ...r.deletedNumbers,
    ];
    const all = [
      ...t.stock.human,
      ...t.stock.ai,
      ...t.hands.human,
      ...t.hands.ai,
      ...t.destroyed.map((d) => d.instance),
    ];
    if (
      new Set(numbers.map((c) => c.instanceId)).size !== numbers.length ||
      numbers.filter((c) => c.origin.type === "initial").length !== 11 ||
      numbers.filter((c) => c.origin.type === "generated").length !==
        r.nextNumberId - 1 ||
      new Set(all.map((c) => c.instanceId)).size !== all.length
    )
      throw new Error("Invalid fixture instance ledger");
    for (const player of ["human", "ai"] as const) {
      if (
        (r.hiddenCards[player] !== null &&
          r.hands[player][0]?.instanceId !== r.hiddenCards[player]) ||
        t.hands[player].length > 8
      )
        throw new Error("Invalid fixture hand");
      if (
        all.length &&
        r.rules.trumps!.resources &&
        all.filter(
          (c) => c.origin.type === "stock" && c.origin.owner === player,
        ).length !==
          Object.values(r.rules.trumps!.resources.stock).reduce(
            (n, c) => n + c,
            0,
          )
      )
        throw new Error("Stock quota changed");
    }
  }
}
