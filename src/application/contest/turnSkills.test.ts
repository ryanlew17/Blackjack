// @req REQ-2026-027: atomic forced continuation and Turn-start grants use existing cancellation/replay.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestCoordinator } from "./coordinator";
import { fixedRandom } from "../../domain/contest/engine/testHelpers";
import { legalSkillCommands } from "../../domain/contest/engine/skills";
import type { MatchEventView, RoundRules } from "../../domain/contest/engine";

function setup(
  human: "mind-grip" | "spirit-sight" = "mind-grip",
  ai: "mind-grip" | "spirit-sight" = "spirit-sight",
  matches = 1,
) {
  const numbers: number[] = [];
  for (let n = 0; n < matches; n++) {
    numbers.push(0.25);
    const shuffle = fixedRandom([10, 8, 11, 9, 1, 2, 3]);
    for (let i = 0; i < 10; i++) numbers.push(shuffle());
  }
  const unexpected = () => {
    throw new Error("Unexpected random stream");
  };
  const random = {
    numbers: vi.fn(() => (numbers.length ? numbers.shift()! : unexpected())),
    trumpGate: vi.fn(unexpected),
    trumpSelection: vi.fn(unexpected),
    skillSelection: vi.fn(unexpected),
    skillEffects: vi.fn(unexpected),
  };
  const roundRules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "danger",
      playableDifficulties: ["danger"],
      selected: { human, ai },
    },
  };
  return { random, roundRules };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("waits for the committed boundary's replay, pauses before takeover, then commits every forced Hit before replay without calling the AI policy", () => {
  const { random, roundRules } = setup(),
    opponent = vi.fn(() => "Stay" as const);
  const api = createContestCoordinator({ random, roundRules, opponent });
  api.start();
  api.skipAnimations();
  expect(api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0])).toBe(
    true,
  );
  api.skipAnimations();
  expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(true);
  expect(api.snapshot()!.round.turn).toMatchObject({
    player: "ai",
    number: 2,
    controlledBy: "human",
  });
  expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(2);
  expect(opponent).not.toHaveBeenCalled();
  api.pause();
  expect(api.getSnapshot().paused).toBe(true);
  vi.runAllTimers();
  expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(2);
  api.resume();
  expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(5);
  expect(api.snapshot()!.round.turn).toEqual({
    player: "human",
    number: 3,
    usedTrump: false,
  });
  expect(api.snapshot()!.round.skills!.human.activations[0].status).toBe(
    "succeeded",
  );
  expect(api.getSnapshot().busy).toBe(true);
  expect(api.getSnapshot().actions).toEqual([]);
  expect(api.sendCommand({ type: "Hit", player: "human" })).toBe(false);
  api.pause();
  api.resume();
  api.skipAnimations();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(5);
  expect(api.getSnapshot().busy).toBe(false);
  expect(opponent).not.toHaveBeenCalled();
  expect(random.numbers).toHaveBeenCalledTimes(11);
  expect(random.trumpGate).not.toHaveBeenCalled();
  expect(random.skillEffects).not.toHaveBeenCalled();
  expect(
    api
      .getSnapshot()
      .recentEvents.filter((e) => e.type === "round" && e.event.type === "hit"),
  ).toHaveLength(3);
  api.exit();
});
it("automatically takes over a human Turn, exposes no internal input, and cancels duplicate publication/resume/skip attempts", () => {
  const { random, roundRules } = setup("spirit-sight", "mind-grip");
  const api = createContestCoordinator({
    random,
    roundRules,
    controlledPlayers: ["human", "ai"],
  });
  const actions: string[][] = [];
  api.subscribe(() => actions.push([...api.getSnapshot().actions]));
  api.start();
  api.skipAnimations();
  api.sendCommand({ type: "Stay", player: "human" });
  api.skipAnimations();
  expect(
    api.sendCommand({
      type: "ActivateSkill",
      player: "ai",
      skillId: "mind-grip",
      turnNumber: 2,
    }),
  ).toBe(true);
  api.skipAnimations();
  expect(api.sendCommand({ type: "Stay", player: "ai" })).toBe(true);
  expect(api.snapshot()!.round.turn).toMatchObject({
    player: "human",
    number: 3,
    controlledBy: "ai",
  });
  api.skipAnimations();
  expect(api.snapshot()!.round.turn).toEqual({
    player: "ai",
    number: 4,
    usedTrump: false,
  });
  expect(api.snapshot()!.round.hands.human.cards).toHaveLength(5);
  expect(actions.flat()).not.toContain("ResolveForcedTurn");
  api.pause();
  api.resume();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()!.round.hands.human.cards).toHaveLength(5);
  expect(
    api.sendCommand({
      type: "ResolveForcedTurn",
      player: "human",
      turnNumber: 3,
    }),
  ).toBe(false);
  expect(random.numbers).toHaveBeenCalledTimes(11);
  api.exit();
});
it.each(["exit", "restart"] as const)(
  "%s from the first forced Hit discards old replay callbacks without undoing or repeating draws",
  (cancel) => {
    const { random, roundRules } = setup("mind-grip", "spirit-sight", 2),
      seen: MatchEventView[] = [];
    let cancelled = false;
    const api = createContestCoordinator({
      random,
      roundRules,
      controlledPlayers: ["human", "ai"],
      onEvent: (event) => {
        seen.push(event);
        if (
          !cancelled &&
          event.type === "round" &&
          event.event.type === "hit"
        ) {
          cancelled = true;
          api[cancel]();
        }
      },
    });
    api.start();
    api.skipAnimations();
    api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0]);
    api.skipAnimations();
    api.sendCommand({ type: "Stay", player: "human" });
    api.skipAnimations();
    expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(5);
    vi.runAllTimers();
    expect(
      seen.filter((e) => e.type === "round" && e.event.type === "hit"),
    ).toHaveLength(1);
    if (cancel === "exit") {
      expect(api.snapshot()).toBeNull();
      expect(random.numbers).toHaveBeenCalledTimes(11);
    } else {
      expect(api.snapshot()!.round.turn).toEqual({
        player: "human",
        number: 1,
        usedTrump: false,
      });
      expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(2);
      expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(1);
      expect(random.numbers).toHaveBeenCalledTimes(22);
      api.exit();
    }
    expect(random.skillEffects).not.toHaveBeenCalled();
  },
);
it("does not commit a takeover after a stable-boundary subscriber exits or pauses", () => {
  for (const cancel of ["exit", "pause"] as const) {
    const { random, roundRules } = setup();
    let armed = false,
      handled = false;
    const api = createContestCoordinator({
      random,
      roundRules,
      controlledPlayers: ["human", "ai"],
    });
    api.subscribe(() => {
      if (
        armed &&
        !handled &&
        !api.getSnapshot().busy &&
        api.getSnapshot().match?.round.turn?.controlledBy
      ) {
        handled = true;
        api[cancel]();
      }
    });
    api.start();
    api.skipAnimations();
    api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0]);
    api.skipAnimations();
    api.sendCommand({ type: "Stay", player: "human" });
    armed = true;
    api.skipAnimations();
    vi.runAllTimers();
    if (cancel === "exit") expect(api.snapshot()).toBeNull();
    else {
      expect(api.getSnapshot().paused).toBe(true);
      expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(2);
      api.resume();
      expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(5);
      api.exit();
    }
    expect(random.numbers).toHaveBeenCalledTimes(11);
  }
});
// @req REQ-2026-029: Provocation commits only its watch, including across replay controls.
it("commits Provocation's watch before feedback and never supplies on pause/resume/skip", () => {
  const shuffle = fixedRandom([10, 8, 11, 9]);
  let coin = true;
  // Six fixed initial selections: human noops and AI burn+noops.
  const samples = [1.5 / 9, 1.5 / 8, 0.5 / 9, 0.5 / 8, 1.5 / 7, 0.5 / 7];
  const unexpected = () => {
    throw new Error("Unexpected randomness");
  };
  const random = {
    numbers: vi.fn(() => (coin ? ((coin = false), 0.25) : shuffle())),
    trumpSelection: vi.fn(() =>
      samples.length ? samples.shift()! : unexpected(),
    ),
    trumpGate: vi.fn(unexpected),
    skillSelection: vi.fn(unexpected),
    skillEffects: vi.fn(unexpected),
  };
  const roundRules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "standard",
      playableDifficulties: ["standard"],
      selected: { human: "provoke", ai: "spirit-sight" },
    },
    trumps: {
      tableCapacity: 5,
      definitions: {
        "burn-hand": { cost: "all-other", onPlay: [] },
        noop: { onPlay: [] },
      },
      resources: {
        difficulty: "standard",
        handLimit: 8,
        gameGrant: 2,
        roundGrant: 1,
        hitProbability: 0.3,
        stock: { "burn-hand": 1, noop: 8 },
      },
    },
  };
  const api = createContestCoordinator({
    random,
    roundRules,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  api.sendCommand({ type: "Stay", player: "human" });
  api.skipAnimations();
  expect(
    api.sendCommand({
      type: "PlayTrump",
      player: "ai",
      instanceId: "game-1:ai:stock-burn-hand-0",
      costIds: ["game-1:ai:stock-noop-0", "game-1:ai:stock-noop-1"],
    }),
  ).toBe(true);
  api.skipAnimations();
  api.sendCommand({ type: "Stay", player: "ai" });
  api.skipAnimations();
  api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0]);
  api.skipAnimations();
  expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(true);
  expect(api.snapshot()!.round.trumps!.opponentHandCount).toBe(0);
  expect(random.trumpSelection).toHaveBeenCalledTimes(6);
  expect(api.getSnapshot().busy).toBe(true);
  api.pause();
  api.resume();
  api.skipAnimations();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()!.round.trumps!.opponentHandCount).toBe(0);
  expect(random.trumpSelection).toHaveBeenCalledTimes(6);
  const grants = api
    .getSnapshot()
    .recentEvents.filter(
      (e) =>
        e.type === "round" &&
        e.event.type === "resource" &&
        e.event.cause === "trigger",
    );
  expect(grants).toEqual([]);
  expect(random.trumpGate).not.toHaveBeenCalled();
  expect(random.skillEffects).not.toHaveBeenCalled();
  api.exit();
});
