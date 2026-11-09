// @req REQ-2026-028: preregistered P4 decision counterexamples, built only by real commands.
import { describe, expect, it } from "vitest";
import {
  createMatch,
  transitionMatch,
  projectMatchTransition,
  observeMatch,
  legalTrumpCommands,
  legalSkillCommands,
} from "../engine";
import type { RoundCommand } from "../engine";
import {
  fixturePorts,
  type BarrierFixtureOptions,
} from "../engine/skillBarrierTestHelpers";
import { createBeliefMemory, advanceBeliefMemory } from "./memory";
import { createSimulation } from "../simulation";
import { decisionCandidates } from "./candidates";
import {
  chooseHeuristic,
  rankDecisions,
  fallbackDecision,
  commandKey,
} from "./heuristic";
import { EVALUATION, evaluateSimulation, settledValue } from "./evaluation";

function fixture(options: BarrierFixtureOptions = {}, target = 21) {
  const ports = fixturePorts({
    human: "spirit-sight",
    ai: "spirit-sight",
    ...options,
  });
  let result = createMatch(
    ports.random,
    { ...ports.rules, pointTarget: target },
    ports.trumpSetup,
  );
  let memory = createBeliefMemory(projectMatchTransition(result, "human"));
  const send = (command: RoundCommand) => {
    const next = transitionMatch(
      result.state,
      { ...command, roundNumber: result.state.roundNumber },
      ports.random,
    );
    expect(next.state).not.toBe(result.state);
    result = next;
    memory = advanceBeliefMemory(
      memory,
      projectMatchTransition(result, "human"),
    );
  };
  return {
    get state() {
      return result.state;
    },
    get memory() {
      return memory;
    },
    send,
    play(id: string) {
      const view = observeMatch(
        result.state,
        result.state.round.turn!.player,
      ).round;
      const card = view.trumps!.ownHand.find((c) => c.definitionId === id)!;
      const command = legalTrumpCommands(view).find(
        (c) => c.instanceId === card.instanceId,
      )!;
      expect(command).toBeDefined();
      send(command);
    },
    reveal() {
      send(legalSkillCommands(memory.observation.round)[0]);
    },
    next() {
      const prefix = options.prefix ?? [10, 8, 11, 9];
      const first =
        result.state.nextFirstPlayer ??
        (result.state.round.firstPlayer === "human" ? "ai" : "human");
      ports.addRound(
        first === "human"
          ? prefix
          : [prefix[1], prefix[0], prefix[3], prefix[2], ...prefix.slice(4)],
      );
      result = transitionMatch(
        result.state,
        { type: "NextRound", roundNumber: result.state.roundNumber },
        ports.random,
      );
      memory = advanceBeliefMemory(
        memory,
        projectMatchTransition(result, "human"),
      );
    },
  };
}
function chosen(f: ReturnType<typeof fixture>, seed = 17) {
  const c = chooseHeuristic(f.memory, seed);
  expect(decisionCandidates(f.memory.observation)).toContainEqual(c);
  return c?.type === "PlayTrump"
    ? f.memory.observation.round.trumps!.ownHand.find(
        (t) => t.instanceId === c.instanceId,
      )!.definitionId
    : c?.type;
}

describe("P4 fixed dynamic decision benchmarks", () => {
  it("rescues a bust with Return rather than stopping or drawing", () => {
    const f = fixture({ humanTrumps: ["return"], prefix: [10, 8, 11, 9, 2] });
    f.reveal();
    f.send({ type: "Hit", player: "human" });
    f.send({ type: "Stay", player: "ai" });
    expect(chosen(f)).toBe("return");
  });
  it("uses the actual raised target rather than a fixed 17/21 threshold", () => {
    const f = fixture(
      { humanTrumps: ["draw-2"], prefix: [11, 10, 9, 8, 3, 6] },
      27,
    );
    f.reveal();
    f.send({ type: "Hit", player: "human" });
    f.send({ type: "Hit", player: "ai" });
    expect(chosen(f)).toBe("draw-2");
  });
  it("changes the target when both current totals favour the change", () => {
    const f = fixture({ humanTrumps: ["target-24"] }, 17);
    f.reveal();
    expect(chosen(f)).toBe("target-24");
  });
  it("clears Symbiosis even though the displayed own total is already 21", () => {
    const f = fixture({
      humanTrumps: ["destroy-all"],
      aiTrumps: ["symbiosis"],
    });
    f.reveal();
    f.send({ type: "Stay", player: "human" });
    f.play("symbiosis");
    f.send({ type: "Stay", player: "ai" });
    expect(f.memory.observation.round.hands.human.total).toBe(21);
    expect(chosen(f)).toBe("destroy-all");
  });
  it("normalizes the hidden multiplier instead of trusting raw card sums", () => {
    const f = fixture({
      humanTrumps: ["normalize"],
      aiTrumps: ["double-hidden"],
    });
    f.reveal();
    f.send({ type: "Stay", player: "human" });
    f.play("double-hidden");
    f.send({ type: "Stay", player: "ai" });
    expect(f.memory.observation.round.hands.human.total).toBe(31);
    expect(chosen(f)).toBe("normalize");
  });
  it("uses Pressure for an actual extra point", () => {
    const f = fixture({ humanTrumps: ["pressure"] });
    f.reveal();
    expect(chosen(f)).toBe("pressure");
  });
  it("uses Full Shield to avoid a known losing Round", () => {
    const f = fixture({ humanTrumps: ["full-shield"], prefix: [8, 10, 9, 11] });
    f.reveal();
    expect(chosen(f)).toBe("full-shield");
  });
  it("values Sudden Death as a Game win, not just one point", () => {
    const f = fixture({ humanTrumps: ["sudden-death", "pressure"] });
    f.reveal();
    expect(chosen(f)).toBe("sudden-death");
    const ranked = rankDecisions(f.memory, 17);
    expect(ranked[0].score).toBeGreaterThan(10);
  });
  it("keeps an unneeded clearing card and unspent Match skill uses", () => {
    const f = fixture({
      human: "frame",
      humanTrumps: ["destroy-all", "reveal-opponent"],
    });
    f.play("reveal-opponent");
    expect(chosen(f)).toBe("Stay");
    expect(f.memory.observation.round.skills!.human.remainingUses).toBe(4);
  });
});

it("reports an actual Hit reversal as downside, without rewarding a harmful counter", () => {
  const f = fixture({ prefix: [8, 9, 10, 7, 3], humanTrumps: ["scry"] });
  f.reveal();
  f.play("scry");
  const model = createSimulation(f.memory, 4);
  const leaf = evaluateSimulation(model, "human", 30);
  expect(leaf.standing.total).toBeGreaterThan(leaf.counter.total);
  expect(leaf.risk).toBeGreaterThan(0);
  expect(leaf.score).toBeCloseTo(
    leaf.standing.total - EVALUATION.counterRisk * leaf.risk,
  );
});

it("raises value at real Game and Match points, and stops valuing resources at a won Match", () => {
  const f = fixture({ humanTrumps: ["sudden-death"] });
  f.reveal();
  const estimates: number[] = [];
  for (let game = 0; game < 3; game++) {
    if (f.state.round.turn!.player !== "human")
      f.send({ type: "Stay", player: "ai" });
    f.play("sudden-death");
    const model = createSimulation(f.memory, 3);
    estimates.push(evaluateSimulation(model, "human", 3).standing.total);
    while (f.state.phase === "playing")
      f.send({ type: "Stay", player: f.state.round.turn!.player });
    if (game < 2) f.next();
  }
  expect(estimates[0]).toBeGreaterThan(10);
  expect(estimates[1] - estimates[0]).toBeGreaterThan(EVALUATION.game);
  expect(estimates[2]).toBe(EVALUATION.match);
});

it("keeps clearing/recovery resources and remaining uses valuable across a Round", () => {
  const rich = fixture({ humanTrumps: ["destroy-all", "skill-revival"] });
  rich.reveal();
  const bare = fixture();
  bare.reveal();
  const a = evaluateSimulation(
    createSimulation(rich.memory, 5),
    "human",
    10,
  ).standing;
  const b = evaluateSimulation(
    createSimulation(bare.memory, 5),
    "human",
    10,
  ).standing;
  expect(a.points).toBe(b.points);
  expect(a.resources - b.resources).toBeCloseTo(
    2 * EVALUATION.hand + EVALUATION.removal + EVALUATION.recovery,
  );
});

it("is reproducible from authorized history and keeps fallback decisions legal", () => {
  const a = fixture({ prefix: [10, 8, 11, 9], aiTrumps: ["draw-2"] });
  const b = fixture({ prefix: [10, 2, 11, 9], aiTrumps: ["return"] });
  expect(a.memory).toEqual(b.memory);
  expect(rankDecisions(a.memory, 12)).toEqual(rankDecisions(b.memory, 12));
  expect(chooseHeuristic(a.memory, 12)).toEqual(chooseHeuristic(b.memory, 12));
  expect(decisionCandidates(a.memory.observation)).toContainEqual(
    fallbackDecision(a.memory.observation),
  );
  expect(commandKey({ type: "Stay", player: "human", roundNumber: 1 })).toBe(
    commandKey({ roundNumber: 1, player: "human", type: "Stay" }),
  );
});

it("passes a reaction legally and returns no decision on another player's Turn or after settlement", () => {
  const f = fixture({ human: "twin-bloom" });
  f.send({ type: "Stay", player: "human" });
  const pass = fallbackDecision(f.memory.observation)!;
  expect(pass.type).toBe("PassReaction");
  expect(decisionCandidates(f.memory.observation)).toContainEqual(
    chooseHeuristic(f.memory, 2),
  );
  f.send(pass);
  expect(chooseHeuristic(f.memory, 2)).toBeNull();
  f.send({ type: "Stay", player: "ai" });
  // Without a skill activation the two quiet stays settle.
  expect(f.state.phase).toBe("round-complete");
  expect(fallbackDecision(f.memory.observation)).toBeNull();
  expect(chooseHeuristic(f.memory, 2)).toBeNull();
});

it("progresses with no trumps, no skills and an empty deck", () => {
  const ports = fixturePorts();
  let result = createMatch(ports.random);
  let memory = createBeliefMemory(projectMatchTransition(result, "human"));
  while (result.state.round.deck.length) {
    result = transitionMatch(
      result.state,
      { type: "Hit", player: result.state.round.turn!.player, roundNumber: 1 },
      ports.random,
    );
    memory = advanceBeliefMemory(
      memory,
      projectMatchTransition(result, "human"),
    );
  }
  if (result.state.round.turn!.player !== "human") {
    result = transitionMatch(
      result.state,
      { type: "Stay", player: "ai", roundNumber: 1 },
      ports.random,
    );
    memory = advanceBeliefMemory(
      memory,
      projectMatchTransition(result, "human"),
    );
  }
  expect(chooseHeuristic(memory, 4)?.type).toBe("Stay");
  expect(fallbackDecision(memory.observation)?.type).toBe("Stay");
  expect(() => settledValue(createSimulation(memory, 1), "human")).toThrow(
    "engine-settled",
  );
});

it("increases the marginal point value near the actual Game target", () => {
  const f = fixture();
  f.reveal();
  const values: number[] = [];
  for (let round = 0; round < 4; round++) {
    values.push(
      evaluateSimulation(createSimulation(f.memory, 6), "human", 20).standing
        .points,
    );
    while (f.state.phase === "playing")
      f.send({ type: "Stay", player: f.state.round.turn!.player });
    expect(f.state.game.points.human).toBe(round + 1);
    if (round < 3) f.next();
  }
  expect(values[3] - values[2]).toBeGreaterThan(values[1] - values[0]);
});

it("values unused Match skill uses after this Game, not an expired Game permission", () => {
  const kept = fixture({
    human: "frame",
    humanTrumps: ["reveal-opponent", "sudden-death"],
  });
  const spent = fixture({
    human: "frame",
    humanTrumps: ["reveal-opponent", "sudden-death"],
  });
  for (const f of [kept, spent]) f.play("reveal-opponent");
  spent.send(legalSkillCommands(spent.memory.observation.round)[0]);
  for (const f of [kept, spent]) f.play("sudden-death");
  const a = evaluateSimulation(
    createSimulation(kept.memory, 4),
    "human",
    7,
  ).standing;
  const b = evaluateSimulation(
    createSimulation(spent.memory, 4),
    "human",
    7,
  ).standing;
  expect(a.game).toBe(b.game);
  expect(a.resources - b.resources).toBeCloseTo(EVALUATION.skillUse);
});

it("keeps each ranked command executable on the actual observed root", () => {
  const f = fixture({
    human: "frame",
    humanTrumps: ["pressure", "destroy-all", "regret", "target-24"],
  });
  for (const value of rankDecisions(f.memory, 91)) {
    expect(Number.isFinite(value.score)).toBe(true);
    const result = transitionMatch(
      f.state,
      value.command,
      fixturePorts().random,
    );
    expect(result.state).not.toBe(f.state);
  }
});

it("values a live recurring generator after Round cleanup and retains skill-use cost", () => {
  const options: BarrierFixtureOptions = {
    human: "endless-life",
    stock: { noop: 8 },
    humanTrumps: ["noop", "noop", "noop"],
    aiTrumps: ["noop", "noop", "noop"],
  };
  const active = fixture(options),
    idle = fixture(options);
  active.send(legalSkillCommands(active.memory.observation.round)[0]);
  const a = evaluateSimulation(
    createSimulation(active.memory, 2),
    "human",
    9,
  ).standing;
  const b = evaluateSimulation(
    createSimulation(idle.memory, 2),
    "human",
    9,
  ).standing;
  expect(a.points).toBe(b.points);
  // The closing path reaches another human Turn: one grant now, four estimated future Rounds.
  expect(a.resources - b.resources).toBeCloseTo(
    EVALUATION.hand +
      4 * EVALUATION.generator -
      EVALUATION.skillUse -
      EVALUATION.permission,
  );
});

it("uses a target-related fallback before sampling even without card or skill candidates", () => {
  const f = fixture({}, 27);
  expect(fallbackDecision(f.memory.observation)?.type).toBe("Hit");
  const other = fixture({}, 17);
  expect(fallbackDecision(other.memory.observation)?.type).toBe("Stay");
});

it("breaks genuinely equivalent card choices reproducibly without static instance priority", () => {
  const f = fixture({ humanTrumps: ["pressure", "pressure"] });
  f.reveal();
  const ranked = rankDecisions(f.memory, 27);
  const pressure = ranked.filter((x) => x.command.type === "PlayTrump");
  expect(pressure).toHaveLength(2);
  expect(pressure[0].score).toBeCloseTo(pressure[1].score);
  expect(chooseHeuristic(f.memory, 27)).toEqual(chooseHeuristic(f.memory, 27));
  expect(pressure.map((x) => x.command)).toContainEqual(
    chooseHeuristic(f.memory, 27),
  );
});

it("keeps the cheap fallback within Hush and controlled-Turn permissions", () => {
  const f = fixture({ prefix: [1, 4, 2, 5], aiTrumps: ["hush"] });
  f.send({ type: "Stay", player: "human" });
  f.play("hush");
  f.send({ type: "Stay", player: "ai" });
  expect(f.memory.observation.round.hands.human.total).toBe(3);
  expect(fallbackDecision(f.memory.observation)?.type).toBe("Stay");
  expect(decisionCandidates(f.memory.observation)).toContainEqual(
    fallbackDecision(f.memory.observation),
  );
  const controlled = fixture({ ai: "mind-grip", first: "ai" });
  controlled.send(
    legalSkillCommands(observeMatch(controlled.state, "ai").round)[0],
  );
  controlled.send({ type: "Stay", player: "ai" });
  expect(controlled.memory.observation.round.turn!.controlledBy).toBe("ai");
  expect(fallbackDecision(controlled.memory.observation)).toBeNull();
});
