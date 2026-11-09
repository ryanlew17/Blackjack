// @req REQ-2026-028: actual-command combination fixtures and bounded search evidence.
import { expect, it } from "vitest";
import {
  createMatch,
  transitionMatch,
  projectMatchTransition,
  observeMatch,
  legalTrumpCommands,
  legalSkillCommands,
} from "../engine";
import type { RoundCommand, MatchCommand } from "../engine";
import {
  fixturePorts,
  type BarrierFixtureOptions,
} from "../engine/skillBarrierTestHelpers";
import { createBeliefMemory, advanceBeliefMemory } from "./memory";
import { decisionCandidates } from "./candidates";
import { chooseHeuristic, fallbackDecision } from "./heuristic";
import { searchDecision, SEARCH_BUDGET, type SearchBudget } from "./search";
import { createSimulation } from "../simulation";
import { evaluateSimulation } from "./evaluation";

function fixture(
  options: BarrierFixtureOptions = {},
  target = 21,
  viewer: "human" | "ai" = "human",
) {
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
  let memory = createBeliefMemory(projectMatchTransition(result, viewer));
  const send = (c: RoundCommand | MatchCommand) => {
    const next = transitionMatch(
      result.state,
      { ...c, roundNumber: result.state.roundNumber },
      ports.random,
    );
    expect(next.state).not.toBe(result.state);
    result = next;
    memory = advanceBeliefMemory(
      memory,
      projectMatchTransition(result, viewer),
    );
  };
  return {
    get state() {
      return result.state;
    },
    get memory() {
      return memory;
    },
    calls: ports.calls,
    send,
    play: (id: string) => {
      const v = observeMatch(
        result.state,
        result.state.round.turn!.player,
      ).round;
      const card = v.trumps!.ownHand.find((c) => c.definitionId === id)!;
      send(
        legalTrumpCommands(v).find((c) => c.instanceId === card.instanceId)!,
      );
    },
    skill: () =>
      send(
        legalSkillCommands(
          observeMatch(
            result.state,
            observeMatch(result.state, "human").round.reaction?.player ??
              result.state.round.turn!.player,
          ).round,
        )[0],
      ),
  };
}
function name(f: ReturnType<typeof fixture>, c: MatchCommand | null) {
  return c?.type === "PlayTrump"
    ? f.memory.observation.round.trumps!.ownHand.find(
        (t) => t.instanceId === c.instanceId,
      )!.definitionId
    : c?.type;
}
function search(
  f: ReturnType<typeof fixture>,
  label: string,
  seed = 17,
  budget: SearchBudget = SEARCH_BUDGET,
) {
  const start = performance.now();
  const result = searchDecision(f.memory, seed, budget);
  if (import.meta.env.VITE_REQ028_BENCH)
    console.log(
      JSON.stringify({
        label,
        seed,
        ms: performance.now() - start,
        action: name(f, result.command),
        ...result.stats,
      }),
    );
  if (result.command)
    expect(decisionCandidates(f.memory.observation)).toContainEqual(
      result.command,
    );
  expect(result.stats.nodes).toBeLessThanOrEqual(budget.maxNodes);
  return result;
}

it("finds two-card improvement which the single-step heuristic misses", () => {
  const f = fixture({
    prefix: [5, 10, 6, 9],
    humanTrumps: ["draw-3", "draw-7", "reveal-opponent"],
    aiTrumps: ["hush"],
  });
  f.play("reveal-opponent");
  f.send({ type: "Stay", player: "human" });
  f.play("hush");
  f.send({ type: "Stay", player: "ai" });
  expect(chooseHeuristic(f.memory, 17)?.type).toBe("Stay");
  const result = search(f, "two-card");
  expect(["draw-3", "draw-7"]).toContain(name(f, result.command));
  expect(result.stats.completedDepth).toBeGreaterThanOrEqual(2);
  f.send(result.command!);
  let next = search(f, "two-card-next");
  if (next.command?.type === "Stay") {
    f.send(next.command);
    f.send({ type: "Stay", player: "ai" });
    next = search(f, "two-card-after-wait");
  }
  expect(["draw-3", "draw-7"]).toContain(name(f, next.command));
  f.send(next.command!);
  expect(f.state.round.hands.human.reduce((n, c) => n + c.value, 0)).toBe(21);
}, 20000);

it("reopens the skill through Revival and chooses activation again", () => {
  const f = fixture({
    human: "self-renewal",
    prefix: [10, 5, 11, 6, 8, 7],
    humanTrumps: [
      "skill-revival",
      "reveal-opponent",
      ...Array<string>(5).fill("delete-self"),
    ],
  });
  f.play("reveal-opponent");
  for (let i = 0; i < 2; i++) {
    f.send({ type: "Hit", player: "human" });
    f.send({ type: "Stay", player: "ai" });
  }
  for (let i = 0; i < 5; i++) {
    f.send({ type: "Hit", player: "human" });
    f.send({ type: "Stay", player: "ai" });
    f.play("delete-self");
  }
  expect(f.state.round.deck).toHaveLength(0);
  const progress = (label: string) => {
    let result = search(f, label);
    // An equivalent non-quiet Stay may defer a resource spend, but the next quiet boundary cannot.
    if (result.command?.type === "Stay") {
      f.send(result.command);
      f.send({ type: "Stay", player: "ai" });
      result = search(f, label + "-after-wait");
    }
    return result;
  };
  const first = progress("revival-start");
  expect(first.command?.type).toBe("ActivateSkill");
  f.send(first.command!);
  const recovery = progress("revival-card");
  expect(name(f, recovery.command)).toBe("skill-revival");
  f.send(recovery.command!);
  const again = progress("revival-activate");
  expect(again.command?.type).toBe("ActivateSkill");
  f.send(again.command!);
  expect(f.state.round.hands.human.reduce((n, c) => n + c.value, 0)).toBe(17);
}, 20000);

it("accounts for order-dependent best-draw effects rather than treating a hand as an unordered set", () => {
  const f = fixture({
    prefix: [1, 5, 9, 11],
    humanTrumps: ["target-17", "best-draw", "reveal-opponent"],
  });
  f.play("reveal-opponent");
  const model = createSimulation(f.memory, 5);
  const play = (root: typeof model, id: string) => {
    const card = root
      .observe("human")
      .round.trumps!.ownHand.find((c) => c.definitionId === id)!;
    return root.step(
      root
        .candidates("human")
        .find(
          (c) => c.type === "PlayTrump" && c.instanceId === card.instanceId,
        )!,
      9,
    ).simulation;
  };
  const correct = play(play(model, "target-17"), "best-draw");
  const wrong = play(play(model, "best-draw"), "target-17");
  expect(evaluateSimulation(correct, "human", 8).score).toBeGreaterThan(
    evaluateSimulation(wrong, "human", 8).score,
  );
  // Best Draw alone already wins under 21, so the economical search need not spend the target card.
  const result = search(f, "order");
  expect(["Stay", "best-draw"]).toContain(name(f, result.command));
  const score = (id: string) =>
    result.values.find((v) => name(f, v.command) === id)!.score;
  expect(score("best-draw")).toBeGreaterThan(score("target-17"));
}, 20000);

it("returns a legal fallback with zero or incomplete budget and preserves a fully completed layer", () => {
  const f = fixture({ humanTrumps: ["pressure"] });
  const zero = search(f, "zero", 2, { ...SEARCH_BUDGET, maxNodes: 0 });
  expect(zero.command).toEqual(fallbackDecision(f.memory.observation));
  expect(zero.stats.nodes).toBe(0);
  expect(zero.stats.fallbacks).toBe(1);
  const tiny = search(f, "tiny", 2, { ...SEARCH_BUDGET, maxNodes: 1 });
  expect(tiny.command).toEqual(zero.command);
  expect(tiny.stats.budgetCuts).toBe(1);
  const shallow = search(f, "shallow", 2, { ...SEARCH_BUDGET, maxDepth: 1 });
  const interrupted = search(f, "interrupted", 2, {
    ...SEARCH_BUDGET,
    maxNodes: shallow.stats.nodes + 1,
  });
  expect(interrupted.values).toEqual(shallow.values);
  expect(interrupted.command).toEqual(shallow.command);
  expect(interrupted.stats.completedDepth).toBe(1);
});

it("rejects invalid budgets and returns no action outside a decision boundary", () => {
  const f = fixture();
  expect(() =>
    searchDecision(f.memory, 1, { ...SEARCH_BUDGET, maxNodes: -1 }),
  ).toThrow("budget");
  f.send({ type: "Stay", player: "human" });
  expect(search(f, "not-actor").command).toBeNull();
  f.send({ type: "Stay", player: "ai" });
  expect(search(f, "settled").command).toBeNull();
});

it.each([true, false])(
  "chooses Twin Bloom activation or pass according to copying value (rescue=%s)",
  (rescue) => {
    const f = fixture({
      human: "twin-bloom",
      prefix: rescue ? [10, 8, 2, 11] : [10, 8, 11, 9],
      humanTrumps: ["hush"],
    });
    f.play("hush");
    f.send({ type: "Stay", player: "human" });
    const result = search(f, rescue ? "twin-activate" : "twin-pass");
    expect(result.command?.type).toBe(
      rescue ? "ActivateSkill" : "PassReaction",
    );
    expect(result.stats.reactionNodes).toBeGreaterThan(0);
    f.send(result.command!);
    if (rescue) {
      const pass = search(f, "twin-pass-after-activation");
      expect(pass.command?.type).toBe("PassReaction");
      f.send(pass.command!);
      f.send({ type: "Stay", player: "ai" });
      expect(f.memory.observation.round.hands.human.total).toBe(21);
      expect(
        f.memory.observation.round.faceUpOrigins[
          f.memory.observation.round.faceUpCardIds.human[0]
        ],
      ).toBe("generated");
    }
  },
  20000,
);

it("plans Soul Transfer against an opposing trump counter that the passive leaf misses", () => {
  const f = fixture({
    human: "soul-transfer",
    ai: "pickpocket",
    humanTrumps: ["reveal-opponent", "double-hidden"],
  });
  f.play("reveal-opponent");
  f.send({ type: "Stay", player: "human" });
  f.skill();
  f.send({ type: "Stay", player: "ai" });
  expect(f.memory.transferredToOpponent.map((c) => c.definitionId)).toEqual([
    "double-hidden",
  ]);
  expect(chooseHeuristic(f.memory, 17)?.type).toBe("Stay");
  const result = search(f, "soul-counter");
  expect(result.command?.type).toBe("ActivateSkill");
  f.send(result.command!);
  f.send({ type: "Stay", player: "human" });
  f.play("double-hidden");
  expect(f.memory.observation.round.hiddenMultipliers.human).toBe(1);
  expect(f.memory.observation.round.skills!.human.activations[0].status).toBe(
    "succeeded",
  );
  expect(
    f.memory.observation.round.trumps!.ownHand.some(
      (c) => c.definitionId === "regret",
    ),
  ).toBe(true);
}, 20000);

it("is reproducible under paired hidden truths and never consumes live random streams", () => {
  const a = fixture({ prefix: [10, 8, 11, 9], aiTrumps: ["draw-2"] });
  const b = fixture({ prefix: [10, 2, 11, 9], aiTrumps: ["return"] });
  expect(a.memory).toEqual(b.memory);
  const before = { ...a.calls };
  const budget = { ...SEARCH_BUDGET, maxNodes: 800, maxDepth: 3 };
  expect(search(a, "hidden-a", 42, budget)).toEqual(
    search(b, "hidden-b", 42, budget),
  );
  expect(search(a, "hidden-repeat", 42, budget)).toEqual(
    search(b, "hidden-repeat-b", 42, budget),
  );
  expect(a.calls).toEqual(before);
  const control = fixture({ prefix: [10, 8, 11, 9], aiTrumps: ["draw-2"] });
  search(a, "changed-budget", 73, { ...budget, maxNodes: 1 });
  a.send({ type: "Hit", player: "human" });
  control.send({ type: "Hit", player: "human" });
  expect(a.state).toEqual(control.state);
  expect(a.calls).toEqual(control.calls);
}, 20000);

it("budgets generation and atomic forced continuations without a player card cap", () => {
  const f = fixture({ human: "mind-grip", humanTrumps: ["gen-hand", "scry"] });
  f.play("scry");
  f.skill();
  const result = search(f, "forced-generation", 19, {
    ...SEARCH_BUDGET,
    maxNodes: 600,
    maxDepth: 4,
  });
  expect(result.stats.nodes).toBe(600);
  expect(result.stats.budgetCuts).toBe(1);
  expect(result.stats.forcedNodes).toBeGreaterThan(0);
  expect(result.command?.type).not.toBe("ResolveForcedTurn");
  f.send({ type: "Stay", player: "human" });
  expect(search(f, "forced-not-actor", 19).command).toBeNull();
}, 20000);

it("maximizes for an AI observer too, without treating human as the fixed maximizing side", () => {
  const f = fixture({ first: "ai", aiTrumps: ["pressure"] }, 21, "ai");
  const result = search(f, "ai-observer", 23, {
    ...SEARCH_BUDGET,
    maxDepth: 3,
  });
  expect(name(f, result.command)).toBe("pressure");
  expect(
    result.command && "player" in result.command && result.command.player,
  ).toBe("ai");
  f.send(result.command!);
});

it("leaves all eight ordinary cards legal even when the search has no expansion budget", () => {
  const f = fixture({ humanTrumps: Array<string>(8).fill("noop") });
  expect(
    decisionCandidates(f.memory.observation).filter(
      (c) => c.type === "PlayTrump",
    ),
  ).toHaveLength(8);
  search(f, "no-player-cap", 9, { ...SEARCH_BUDGET, maxNodes: 0 });
  for (let n = 0; n < 8; n++) f.play("noop");
  expect(f.state.round.turn!.player).toBe("human");
  expect(f.state.round.trumps!.hands.human).toHaveLength(0);
});

// @req REQ-2026-028 P7: full high-tier resource pool, without changing the common search budget.
it.each([
  "nullify",
  "self-renewal",
  "twin-bloom",
  "mind-grip",
  "endless-life",
] as const)(
  "searches a real high-tier %s boundary with the shared production budget",
  (human) => {
    const f = fixture({
      human,
      prefix: [10, 8, 11, 9, 7],
      humanTrumps: ["skill-revival", "regret", "draw-2"],
      aiTrumps: ["skill-revival", "regret", "draw-2"],
      stock: {
        "skill-revival": 2,
        regret: 2,
        "draw-2": 2,
        "forced-draw": 2,
        "heavy-hit": 2,
      },
    });
    if (human === "twin-bloom") f.send({ type: "Stay", player: "human" });
    if (human === "self-renewal") {
      f.send({ type: "Hit", player: "human" });
      f.send({ type: "Stay", player: "ai" });
    }
    const result = search(f, "high-" + human, 19);
    expect(result.command).not.toBeNull();
    expect(result.stats.completedDepth).toBeGreaterThan(0);
    f.send(result.command!);
  },
);
