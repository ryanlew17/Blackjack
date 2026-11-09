// @req REQ-2026-028: compare model execution with real commands under authorized known information.
import { describe, it, expect } from "vitest";
import {
  createMatch,
  projectMatchTransition,
  observeMatch,
  transitionMatch,
  legalTrumpCommands,
  legalSkillCommands,
} from "../engine";
import type { RoundCommand, MatchState } from "../engine";
import {
  fixturePorts,
  type BarrierFixtureOptions,
} from "../engine/skillBarrierTestHelpers";
import { createBeliefMemory, advanceBeliefMemory } from "../ai/memory";
import { createSimulation } from "./index";
import { ADMITTED_TRUMP_IDS } from "../trumps/admitted";
import { EXECUTABLE_SKILL_IDS } from "../engine/skills";
import { seededRandom } from "../random";

function fixture(options: BarrierFixtureOptions = {}) {
  const ports = fixturePorts(options);
  let state = createMatch(ports.random, ports.rules, ports.trumpSetup);
  let memory = createBeliefMemory(projectMatchTransition(state, "human"));
  return {
    get state() {
      return state.state;
    },
    get memory() {
      return memory;
    },
    send(command: RoundCommand, seed?: number) {
      const random = seed === undefined ? ports.random : sources(seed);
      state = transitionMatch(
        state.state,
        { ...command, roundNumber: state.state.roundNumber },
        random,
      );
      memory = advanceBeliefMemory(
        memory,
        projectMatchTransition(state, "human"),
      );
      return projectMatchTransition(state, "human");
    },
    command(id: string) {
      const view = observeMatch(
        state.state,
        state.state.round.turn!.player,
      ).round;
      const card = view.trumps!.ownHand.find((c) => c.definitionId === id)!;
      return legalTrumpCommands(view).find(
        (c) => c.instanceId === card.instanceId,
      )!;
    },
  };
}
function sources(seed: number) {
  return {
    numbers: seededRandom(seed),
    trumpGate: seededRandom(seed + 1),
    trumpSelection: seededRandom(seed + 2),
    skillSelection: seededRandom(seed + 3),
    skillEffects: seededRandom(seed + 4),
  };
}

// Unseen future IDs are opaque hypotheses; compare values and every binding using stable slot labels.
function outcome(view: import("../engine").MatchObservation) {
  const ids = new Map<string, string>();
  for (const p of ["human", "ai"] as const)
    view.round.faceUpCardIds[p].forEach((id, i) =>
      ids.set(id, `number:${p}:${i}`),
    );
  view.round.trumps?.ownHand.forEach((c, i) =>
    ids.set(c.instanceId, `hand:${i}`),
  );
  view.round.trumps?.destroyed.forEach((d, i) => {
    if (d.instance) ids.set(d.instance.instanceId, `destroyed:${i}`);
  });
  const visit = (value: unknown): unknown =>
    typeof value === "string"
      ? (ids.get(value) ?? value)
      : Array.isArray(value)
        ? value.map(visit)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([k, v]) => [
                ids.get(k) ?? k,
                visit(v),
              ]),
            )
          : value;
  return visit(view);
}

it("accepts only projected memory, reproduces its observation and keeps branches immutable", () => {
  const f = fixture({ human: "spirit-sight", humanTrumps: ["return"] });
  const simulation = createSimulation(f.memory, 4);
  expect(simulation.observe("human")).toEqual(f.memory.observation);
  const acceptsState: MatchState extends Parameters<typeof createSimulation>[0]
    ? true
    : false = false;
  expect(acceptsState).toBe(false);
  const before = simulation.observe("human");
  const command = simulation
    .candidates("human")
    .find((c) => c.type === "Stay")!;
  expect(simulation.step(command, 7).accepted).toBe(true);
  expect(simulation.observe("human")).toEqual(before);
  expect(simulation.step({ ...command, roundNumber: 999 }, 7).accepted).toBe(
    false,
  );
});

describe("known one-step effects and reconstructed undo", () => {
  it.each([
    "target-17",
    "target-24",
    "symbiosis",
    "double-hidden",
    "face-lighten",
    "face-burden",
    "pressure",
    "shield",
    "hush",
    "sudden-death",
    "return",
    "draw-2",
    "exchange",
    "gen-one",
    "delete-self",
  ])("matches %s and Regret", (id) => {
    const f = fixture({
      human: "spirit-sight",
      humanTrumps: ["reveal-opponent", id, "regret"],
    });
    f.send(f.command("reveal-opponent"));
    const root = createSimulation(f.memory, 8);
    const command = f.command(id);
    expect(command).toBeDefined();
    const result = root.step(
      { ...command, roundNumber: f.state.roundNumber },
      3,
    );
    expect(result.accepted).toBe(true);
    const real = f.send(command, 3);
    expect(outcome(result.transition.state)).toEqual(outcome(real.state));
    // Re-enter through projected history: no synthetic/real authoritative transaction crosses the port.
    const rehydrated = createSimulation(f.memory, 8);
    const undo = f.command("regret");
    expect(undo).toBeDefined();
    const inverse = rehydrated.step(
      { ...undo, roundNumber: f.state.roundNumber },
      7,
    );
    expect(inverse.accepted).toBe(true);
    expect(inverse.transition.state).toEqual(f.send(undo, 7).state);
  });
});

it("uses the same Game-winning sudden-death settlement instead of a second scorer", () => {
  const f = fixture({
    human: "spirit-sight",
    humanTrumps: ["reveal-opponent", "sudden-death"],
  });
  f.send(f.command("reveal-opponent"));
  f.send(f.command("sudden-death"));
  let simulation = createSimulation(f.memory, 2);
  for (let i = 0; i < 3 && f.state.phase === "playing"; i++) {
    const command = {
      type: "Stay" as const,
      player: f.state.round.turn!.player,
    };
    const step = simulation.step(
      { ...command, roundNumber: f.state.roundNumber },
      22,
    );
    expect(step.transition.state).toEqual(f.send(command, 22).state);
    simulation = step.simulation;
  }
  expect(f.state.phase).toBe("game-complete");
});

it("preserves a private Spirit Sight authorization and executes recovery with the real engine", () => {
  const f = fixture({
    human: "spirit-sight",
    humanTrumps: ["skill-revival", "regret"],
  });
  f.send(legalSkillCommands(f.memory.observation.round)[0]);
  const simulation = createSimulation(f.memory, 9);
  const command = f.command("skill-revival");
  const predicted = simulation.step(
    { ...command, roundNumber: f.state.roundNumber },
    1,
  );
  expect(predicted.transition.state).toEqual(f.send(command, 1).state);
  const rebuilt = createSimulation(f.memory, 9);
  const undo = f.command("regret");
  expect(
    rebuilt.step({ ...undo, roundNumber: f.state.roundNumber }, 2).transition
      .state,
  ).toEqual(f.send(undo, 2).state);
});

describe("54 admitted effect definitions", () => {
  it.each(ADMITTED_TRUMP_IDS)(
    "constructs and executes %s from the same authorized state",
    (id) => {
      const f = fixture({
        human: "spirit-sight",
        humanTrumps: [id, "regret", "pressure", "scry", "noop", "noop", "noop"],
        aiTrumps: ["shield", "double-hidden"],
      });
      f.send(legalSkillCommands(f.memory.observation.round)[0]);
      const choose = (instanceId: string) =>
        legalTrumpCommands(
          observeMatch(f.state, f.state.round.turn!.player).round,
        ).find((c) => c.instanceId === instanceId)!;
      f.send(choose("h-2"));
      f.send({ type: "Stay", player: "human" });
      f.send(choose("a-0"));
      f.send(choose("a-1"));
      f.send({ type: "Stay", player: "ai" });
      f.send(choose("h-3"));
      const simulation = createSimulation(f.memory, 19);
      const command = choose("h-0");
      expect(command).toBeDefined();
      const prediction = simulation.step(
        { ...command, roundNumber: f.state.roundNumber },
        11,
      );
      expect(prediction.accepted).toBe(true);
      const actual = f.send(command, 11);
      expect(outcome(prediction.transition.state)).toEqual(
        outcome(actual.state),
      );
      expect(createSimulation(f.memory, 19).observe("human")).toEqual(
        actual.state,
      );
      const undo = f.memory.observation.round.trumps!.ownHand.find(
        (c) => c.definitionId === "regret",
      );
      const undoCommand = legalTrumpCommands(f.memory.observation.round).find(
        (c) => c.instanceId === undo?.instanceId,
      );
      if (undoCommand) {
        const rebuilt = createSimulation(f.memory, 19);
        const inverse = rebuilt.step(
          { ...undoCommand, roundNumber: f.state.roundNumber },
          10,
        );
        expect(outcome(inverse.transition.state)).toEqual(
          outcome(f.send(undoCommand, 10).state),
        );
      }
    },
  );
});

describe("15 admitted skill definitions", () => {
  it.each(EXECUTABLE_SKILL_IDS)("represents and executes %s", (id) => {
    const resources = [
      "pickpocket",
      "craft-gift",
      "fortune",
      "endless-life",
    ].includes(id);
    const f = fixture({
      human: id,
      ai: "spirit-sight",
      ...(resources
        ? {
            stock: { noop: 8 },
            humanTrumps: ["noop", "noop", "noop"],
            aiTrumps: ["noop", "noop", "noop"],
          }
        : {}),
      ...(id === "scapegoat" ? { prefix: [1, 2, 3, 11, 10, 9] } : {}),
    });
    if (id === "craft-gift")
      for (let i = 0; i < 3; i++) f.send(f.command("noop"));
    if (id === "self-renewal") {
      f.send({ type: "Hit", player: "human" });
      f.send({ type: "Stay", player: "ai" });
    }
    if (id === "scapegoat") {
      f.send({ type: "Stay", player: "human" });
      f.send({ type: "Hit", player: "ai" });
    }
    if (id === "spirit-sight") {
      while (f.state.round.deck.length)
        f.send({ type: "Hit", player: f.state.round.turn!.player });
      if (f.state.round.turn!.player !== "human")
        f.send({ type: "Stay", player: "ai" });
    }
    if (id === "twin-bloom") f.send({ type: "Stay", player: "human" });
    const simulation = createSimulation(f.memory, 8);
    const command = legalSkillCommands(f.memory.observation.round)[0];
    expect(command).toBeDefined();
    const prediction = simulation.step(
      { ...command, roundNumber: f.state.roundNumber },
      11,
    );
    expect(prediction.accepted).toBe(true);
    const actual = f.send(command, 11);
    expect(outcome(prediction.transition.state)).toEqual(outcome(actual.state));
    expect(createSimulation(f.memory, 8).observe("human")).toEqual(
      actual.state,
    );
  });
});

it("keeps Twin Bloom activation/pass and receiving-Turn copying on the engine boundary", () => {
  const f = fixture({
    human: "twin-bloom",
    ai: "spirit-sight",
    humanTrumps: ["noop"],
  });
  f.send(f.command("noop"));
  f.send({ type: "Stay", player: "human" });
  let sim = createSimulation(f.memory, 12);
  const activation = legalSkillCommands(f.memory.observation.round)[0];
  const reaction = f.memory.observation.round.reaction!;
  for (const command of [
    activation,
    {
      type: "PassReaction" as const,
      player: "human" as const,
      turnNumber: reaction.turnNumber,
      reactionBoundary: reaction.boundary,
    },
    { type: "Stay" as const, player: "ai" as const },
  ]) {
    const step = sim.step({ ...command, roundNumber: f.state.roundNumber }, 5);
    expect(step.accepted).toBe(true);
    expect(outcome(step.transition.state)).toEqual(
      outcome(f.send(command, 5).state),
    );
    sim = step.simulation;
  }
  expect(sim.observe("human").round.hands.human.cards[1].value).toBe(9);
});

it("executes Nullify lock/disable and rehydrates the public seal", () => {
  const f = fixture({ human: "nullify", ai: "spirit-sight" });
  const sim = createSimulation(f.memory, 3),
    command = legalSkillCommands(f.memory.observation.round)[0];
  const step = sim.step({ ...command, roundNumber: f.state.roundNumber }, 5);
  const real = f.send(command, 5);
  expect(step.transition.state).toEqual(real.state);
  expect(
    createSimulation(f.memory, 3).observe("human").round.skillSeal,
  ).toEqual({ throughRound: 3 });
});

it("uses the internal forced-Turn command and never breaks it into independently submitted Hits", () => {
  const f = fixture({ human: "mind-grip", humanTrumps: ["scry"] });
  f.send(f.command("scry"));
  f.send(legalSkillCommands(f.memory.observation.round)[0]);
  f.send({ type: "Stay", player: "human" });
  const sim = createSimulation(f.memory, 3);
  const commands = sim.candidates("ai");
  expect(commands.map((c) => c.type)).toEqual(["ResolveForcedTurn"]);
  const step = sim.step(commands[0], 5);
  expect(step.accepted).toBe(true);
  expect(
    step.simulation.observe("human").round.turn?.controlledBy,
  ).toBeUndefined();
  expect(
    step.transition.events.filter(
      (e) => e.type === "round" && e.event.type === "hit",
    ).length,
  ).toBeLessThanOrEqual(3);
});

it("is independent of hidden truth, samples and steps without touching live random streams", () => {
  const a = fixture({
    human: "spirit-sight",
    aiTrumps: ["return"],
    prefix: [10, 8, 11, 9],
  });
  const b = fixture({
    human: "spirit-sight",
    aiTrumps: ["draw-2"],
    prefix: [10, 2, 11, 9],
  });
  expect(a.memory).toEqual(b.memory);
  const before = a.state;
  const x = createSimulation(a.memory, 12),
    y = createSimulation(b.memory, 12);
  expect(x.observe("ai")).toEqual(y.observe("ai"));
  const command = x.candidates("human").find((c) => c.type === "Stay")!;
  expect(x.step(command, 8).transition).toEqual(y.step(command, 8).transition);
  expect(a.state).toBe(before);
});

it("jointly allocates stock/hand resources and reverses actual grants without restoring payments", () => {
  const f = fixture({
    human: "spirit-sight",
    stock: { "shared-supply": 1, regret: 1, noop: 6 },
    humanTrumps: ["shared-supply", "regret", "noop"],
    aiTrumps: ["shared-supply", "regret", "noop"],
  });
  const root = createSimulation(f.memory, 4),
    command = f.command("shared-supply");
  const step = root.step({ ...command, roundNumber: 1 }, 8);
  expect(outcome(step.transition.state)).toEqual(
    outcome(f.send(command, 8).state),
  );
  const rebuilt = createSimulation(f.memory, 4),
    undo = f.command("regret");
  const inverse = rebuilt.step({ ...undo, roundNumber: 1 }, 9);
  expect(outcome(inverse.transition.state)).toEqual(
    outcome(f.send(undo, 9).state),
  );
});

it("retains public stock deletion/restoration through a fresh simulated undo window", () => {
  const f = fixture({
    human: "spirit-sight",
    stock: { "banish-copy": 1, regret: 2, noop: 6 },
    humanTrumps: ["banish-copy", "regret", "regret"],
    aiTrumps: ["banish-copy", "regret", "regret"],
  });
  const banish = legalTrumpCommands(f.memory.observation.round).find(
    (c) =>
      c.instanceId === f.command("banish-copy").instanceId &&
      c.definitionId === "noop",
  )!;
  f.send(banish);
  const rebuilt = createSimulation(f.memory, 4),
    undo = f.command("regret");
  expect(
    outcome(rebuilt.step({ ...undo, roundNumber: 1 }, 9).transition.state),
  ).toEqual(outcome(f.send(undo, 9).state));
  const again = createSimulation(f.memory, 4),
    second = f.command("regret");
  expect(
    outcome(again.step({ ...second, roundNumber: 1 }, 9).transition.state),
  ).toEqual(outcome(f.send(second, 9).state));
});

it("preserves number identity across draw, undo and undo-of-undo reconstruction", () => {
  const f = fixture({
    human: "spirit-sight",
    humanTrumps: ["draw-2", "regret", "regret"],
  });
  f.send(f.command("draw-2"));
  f.send(f.command("regret"));
  const sim = createSimulation(f.memory, 2),
    command = f.command("regret");
  expect(sim.step({ ...command, roundNumber: 1 }, 2).transition.state).toEqual(
    f.send(command, 2).state,
  );
});

it("retains Soul Transfer's private preparation, redirected effects and non-undoable reward", () => {
  const f = fixture({
    human: "soul-transfer",
    ai: "spirit-sight",
    stock: { pressure: 8 },
    humanTrumps: ["pressure", "pressure", "pressure"],
    aiTrumps: ["pressure", "pressure", "pressure"],
  });
  f.send(legalSkillCommands(f.memory.observation.round)[0]);
  f.send({ type: "Stay", player: "human" });
  const sim = createSimulation(f.memory, 3),
    command = f.command("pressure");
  const sampled = sim.candidates("ai").find((c) => c.type === "PlayTrump")!;
  const predicted = sim.step(sampled, 4);
  expect(outcome(predicted.transition.state)).toEqual(
    outcome(f.send(command, 4).state),
  );
  expect(createSimulation(f.memory, 3).observe("human")).toEqual(
    f.memory.observation,
  );
  expect(
    f.memory.observation.round.trumps!.ownHand.some(
      (c) => c.definitionId === "regret",
    ),
  ).toBe(true);
});

it.each(["metamorphosis", "tempt-fate", "frame"] as const)(
  "retains %s pending settlement and score semantics",
  (id) => {
    const f = fixture({
      human: id,
      ai: "spirit-sight",
      prefix: [1, 8, 11, 9],
      humanTrumps: ["reveal-opponent", "double-hidden", "symbiosis"],
    });
    for (const card of ["reveal-opponent", "double-hidden", "symbiosis"])
      f.send(f.command(card));
    f.send(legalSkillCommands(f.memory.observation.round)[0]);
    let sim = createSimulation(f.memory, 3);
    for (let n = 0; n < 3 && f.state.phase === "playing"; n++) {
      const command = {
        type: "Stay" as const,
        player: f.state.round.turn!.player,
      };
      const next = sim.step({ ...command, roundNumber: 1 }, 4);
      expect(next.transition.state).toEqual(f.send(command, 4).state);
      sim = next.simulation;
    }
    expect(f.state.round.phase).toBe("settled");
  },
);

it("preserves Endless Life provenance and generation through Nullify and the next Round", () => {
  const f = fixture({
    human: "endless-life",
    ai: "nullify",
    stock: { noop: 8 },
    humanTrumps: ["noop", "noop", "noop"],
    aiTrumps: ["noop", "noop", "noop"],
  });
  f.send(legalSkillCommands(f.memory.observation.round)[0]);
  f.send(f.command("noop"));
  f.send({ type: "Stay", player: "human" });
  const command = legalSkillCommands(observeMatch(f.state, "ai").round)[0];
  const sim = createSimulation(f.memory, 1);
  expect(
    outcome(sim.step({ ...command, roundNumber: 1 }, 3).transition.state),
  ).toEqual(outcome(f.send(command, 3).state));
  let branch = createSimulation(f.memory, 1);
  // Continue in the sampled world: no unknown hidden truth is asserted equal to the real one.
  for (let n = 0; n < 3 && branch.observe("human").phase === "playing"; n++) {
    const view = branch.observe("human");
    const next = branch.step(
      {
        type: "Stay",
        player: view.round.turn!.player,
        roundNumber: view.roundNumber,
      },
      7,
    );
    expect(next.accepted).toBe(true);
    branch = next.simulation;
  }
  const next = branch.step(branch.candidates("human")[0], 8);
  expect(next.accepted).toBe(true);
  expect(next.simulation.observe("human").roundNumber).toBe(2);
  expect(next.simulation.observe("human").round.skillSeal).toEqual({
    throughRound: 3,
  });
  const renewed = createBeliefMemory(next.transition);
  expect(createSimulation(renewed, 2).observe("human")).toEqual(
    next.transition.state,
  );
});

it("reconstructs both observers along committed resource/skill histories", () => {
  for (const skill of EXECUTABLE_SKILL_IDS) {
    const ports = fixturePorts({
      human: skill,
      ai: "endless-life",
      stock: { noop: 8, regret: 2, "shared-supply": 2 },
      humanTrumps: ["noop", "regret", "shared-supply"],
      aiTrumps: ["noop", "regret", "shared-supply"],
    });
    let result = createMatch(ports.random, ports.rules);
    const viewers = ["human", "ai"] as const;
    let memories = viewers.map((p) =>
      createBeliefMemory(projectMatchTransition(result, p)),
    );
    for (let n = 0; n < 24; n++) {
      const state = result.state;
      if (state.phase === "complete") break;
      if (state.phase === "playing") {
        for (const [i, p] of viewers.entries())
          expect(
            createSimulation(memories[i], n + 40).observe(p),
            skill + " " + p + " " + n,
          ).toEqual(memories[i].observation);
      }
      const p =
        (state.round.reactionState &&
          observeMatch(state, "human").round.reaction?.player) ||
        state.round.turn?.player ||
        "human";
      const view = observeMatch(state, p);
      const skillCommand = legalSkillCommands(view.round)[0];
      const trumps = legalTrumpCommands(view.round);
      const command =
        state.phase !== "playing"
          ? { type: "NextRound" as const, roundNumber: state.roundNumber }
          : view.round.reaction
            ? (skillCommand ?? {
                type: "PassReaction" as const,
                player: p,
                turnNumber: view.round.turn!.number,
                reactionBoundary: view.round.reaction.boundary,
                roundNumber: state.roundNumber,
              })
            : view.round.turn?.controlledBy
              ? {
                  type: "ResolveForcedTurn" as const,
                  player: p,
                  turnNumber: view.round.turn.number,
                  roundNumber: state.roundNumber,
                }
              : (skillCommand ??
                (n % 3 === 0 ? trumps[0] : undefined) ?? {
                  type: "Stay" as const,
                  player: p,
                  roundNumber: state.roundNumber,
                });
      const next = transitionMatch(
        state,
        { ...command, roundNumber: state.roundNumber },
        sources(n + 60),
      );
      expect(next.state, skill + " " + n).not.toBe(state);
      result = next;
      memories = viewers.map((who, i) =>
        advanceBeliefMemory(memories[i], projectMatchTransition(result, who)),
      );
    }
  }
});

it("projects the same public upper bound to both observers without disclosing secret spending", () => {
  const f = fixture({ human: "soul-transfer" });
  const before = f.memory.observation.round.skills!.human;
  const opponentBefore = observeMatch(f.state, "ai");
  f.send(legalSkillCommands(f.memory.observation.round)[0]);
  const own = f.memory.observation.round.skills!.human;
  expect(own.remainingUses).toBe(before.remainingUses! - 1);
  expect(own.publicRemainingUses).toBe(before.publicRemainingUses);
  expect(observeMatch(f.state, "ai")).toEqual(opponentBefore);
  expect(
    observeMatch(f.state, "ai").round.skills!.human.publicRemainingUses,
  ).toBe(own.publicRemainingUses);
});

it("does not assign Nullify-deleted hidden slots to immune generated cards", () => {
  const f = fixture({
    human: "nullify",
    ai: "endless-life",
    first: "ai",
    stock: { noop: 8 },
    humanTrumps: ["noop", "noop", "noop"],
    aiTrumps: ["noop", "noop", "noop"],
  });
  f.send(legalSkillCommands(observeMatch(f.state, "ai").round)[0]);
  f.send(f.command("noop"));
  f.send({ type: "Stay", player: "ai" });
  f.send(f.command("noop"));
  f.send({ type: "Stay", player: "human" });
  // AI Turn-start grants its first immune copy, then hands over without spending it.
  f.send(f.command("noop"));
  f.send({ type: "Stay", player: "ai" });
  f.send(legalSkillCommands(f.memory.observation.round)[0]);
  expect(f.memory.observation.round.trumps!.opponentHandCount).toBe(1);
  for (const seed of [1, 3, 8]) {
    const cards = createSimulation(f.memory, seed).observe("ai").round.trumps!
      .ownHand;
    expect(cards).toHaveLength(1);
    expect(cards[0].origin).toMatchObject({
      type: "generated",
      skillId: "endless-life",
    });
  }
});

it("rebuilds a supply undo window after Pickpocket transfers its hidden last grant", () => {
  const f = fixture({
    human: "pickpocket",
    stock: { "shared-supply": 1, regret: 1, noop: 6 },
    humanTrumps: ["shared-supply", "regret", "noop"],
    aiTrumps: ["shared-supply", "regret", "noop"],
    effects: [0.99],
  });
  f.send(f.command("shared-supply"));
  f.send(legalSkillCommands(f.memory.observation.round)[0]);
  const rebuilt = createSimulation(f.memory, 4),
    undo = f.command("regret");
  expect(
    outcome(rebuilt.step({ ...undo, roundNumber: 1 }, 9).transition.state),
  ).toEqual(outcome(f.send(undo, 9).state));
});
