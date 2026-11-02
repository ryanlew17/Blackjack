// @req REQ-2026-027: private preparation, committed redirected outcomes and cancellation share the existing coordinator.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestCoordinator } from "./coordinator";
import { fixedRandom } from "../../domain/contest/engine/testHelpers";
import type { MatchEventView, RoundRules } from "../../domain/contest/engine";
import { NUMBER_TRUMP_DEFINITIONS } from "../../domain/contest/trumps/numberDefinitions";

function setup() {
  let coin = true;
  const shuffle = fixedRandom([10, 8, 11, 9]);
  const unexpected = () => {
    throw new Error("Unexpected random stream");
  };
  const random = {
    numbers: vi.fn(() => (coin ? ((coin = false), 0.25) : shuffle())),
    trumpGate: vi.fn(unexpected),
    trumpSelection: vi.fn(unexpected),
    skillSelection: vi.fn(unexpected),
    skillEffects: vi.fn(unexpected),
  };
  const roundRules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "standard",
      playableDifficulties: ["standard"],
      selected: { human: "spirit-sight", ai: "soul-transfer" },
    },
    trumps: {
      tableCapacity: 5,
      definitions: {
        ...NUMBER_TRUMP_DEFINITIONS,
        noop: { onPlay: [] },
        "paid-draw": { cost: 1, onPlay: [{ type: "draw-number", value: 2 }] },
      },
    },
  };
  const trumpSetup = {
    human: [
      { instanceId: "draw", definitionId: "paid-draw" },
      { instanceId: "cost", definitionId: "noop" },
      { instanceId: "scry", definitionId: "scry" },
    ],
    ai: [],
  };
  return {
    random,
    roundRules,
    trumpSetup,
    controlledPlayers: ["human", "ai"] as const,
  };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("keeps opposing Soul preparation invisible to feedback, legal choices and busy, then commits its redirected effect/reward before replay exactly once", () => {
  const options = setup(),
    api = createContestCoordinator(options);
  api.start();
  api.skipAnimations();
  api.sendCommand({ type: "Hit", player: "human" });
  api.skipAnimations();
  const before = api.getSnapshot();
  expect(
    api.sendCommand({
      type: "ActivateSkill",
      player: "ai",
      skillId: "soul-transfer",
      turnNumber: 2,
    }),
  ).toBe(true);
  const after = api.getSnapshot();
  expect(after.match).toEqual(before.match);
  expect(after.recentEvents).toEqual(before.recentEvents);
  expect(after.actions).toEqual(before.actions);
  expect(after.trumpCommands).toEqual(before.trumpCommands);
  expect(after.busy).toBe(false);
  expect(after.effectId).toBe(before.effectId);
  api.sendCommand({ type: "Stay", player: "ai" });
  api.skipAnimations();
  const turn = api.snapshot()!.round.turn;
  const command = {
    type: "PlayTrump" as const,
    player: "human" as const,
    instanceId: "draw",
    costIds: ["cost"],
  };
  expect(api.sendCommand(command)).toBe(true);
  expect(api.snapshot()!.round.turn).toEqual({ ...turn!, usedTrump: true });
  expect(api.snapshot()!.round.hands.ai.cards.at(-1)!.value).toBe(2);
  expect(api.snapshot()!.round.trumps!.opponentHandCount).toBe(1);
  expect(api.snapshot()!.round.skills!.ai.knownRemainingUses.max).toBe(0);
  expect(api.getSnapshot().busy).toBe(true);
  expect(api.sendCommand(command)).toBe(false);
  api.pause();
  api.resume();
  api.skipAnimations();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()!.round.hands.ai.cards).toHaveLength(3);
  expect(api.snapshot()!.round.trumps!.opponentHandCount).toBe(1);
  expect(api.snapshot()!.round.lastPlay).toMatchObject({
    player: "human",
    effectPlayer: "ai",
    instanceId: "draw",
  });
  expect(
    api
      .getSnapshot()
      .recentEvents.filter(
        (e) =>
          e.type === "round" &&
          e.event.type === "skill" &&
          e.event.skillId === "soul-transfer",
      ),
  ).toHaveLength(1);
  expect(options.random.numbers).toHaveBeenCalledTimes(11);
  expect(options.random.skillEffects).not.toHaveBeenCalled();
  api.exit();
});
it("never exposes redirected opposing Scry payloads or knowledge through the human coordinator", () => {
  const options = setup(),
    seen: MatchEventView[] = [];
  const api = createContestCoordinator({
    ...options,
    onEvent: (event) => seen.push(event),
  });
  api.start();
  api.skipAnimations();
  api.sendCommand({ type: "Hit", player: "human" });
  api.skipAnimations();
  api.sendCommand({
    type: "ActivateSkill",
    player: "ai",
    skillId: "soul-transfer",
    turnNumber: 2,
  });
  api.sendCommand({ type: "Stay", player: "ai" });
  api.skipAnimations();
  api.sendCommand({ type: "PlayTrump", player: "human", instanceId: "scry" });
  vi.runAllTimers();
  expect(api.snapshot()!.round.peek).toBeNull();
  const peek = seen.flatMap((e) =>
    e.type === "round" && e.event.type === "trump" && e.event.effect === "peek"
      ? [e.event]
      : [],
  );
  expect(peek).toHaveLength(1);
  expect(peek[0]).toMatchObject({ player: "human", effectPlayer: "ai" });
  expect(peek[0].privateCards).toBeUndefined();
  expect(
    api
      .getSnapshot()
      .recentEvents.some(
        (e) =>
          e.type === "round" &&
          e.event.type === "trump" &&
          e.event.privateCards !== undefined,
      ),
  ).toBe(false);
  api.exit();
});
it("invalidates all remaining redirected replay when an interception subscriber exits", () => {
  const options = setup(),
    seen: MatchEventView[] = [];
  const api = createContestCoordinator({
    ...options,
    onEvent: (event) => {
      seen.push(event);
      if (
        event.type === "round" &&
        event.event.type === "skill" &&
        event.event.skillId === "soul-transfer" &&
        event.event.status === "succeeded"
      )
        api.exit();
    },
  });
  api.start();
  api.skipAnimations();
  api.sendCommand({ type: "Hit", player: "human" });
  api.skipAnimations();
  api.sendCommand({
    type: "ActivateSkill",
    player: "ai",
    skillId: "soul-transfer",
    turnNumber: 2,
  });
  api.sendCommand({ type: "Stay", player: "ai" });
  api.skipAnimations();
  api.sendCommand({
    type: "PlayTrump",
    player: "human",
    instanceId: "draw",
    costIds: ["cost"],
  });
  expect(api.snapshot()!.round.hands.ai.cards.at(-1)!.value).toBe(2);
  vi.runAllTimers();
  expect(api.snapshot()).toBeNull();
  expect(api.getSnapshot().match).toBeNull();
  expect(
    seen.filter(
      (e) =>
        e.type === "round" &&
        e.event.type === "trump" &&
        e.event.effect === "draw",
    ),
  ).toEqual([]);
  expect(options.random.numbers).toHaveBeenCalledTimes(11);
  expect(options.random.trumpSelection).not.toHaveBeenCalled();
});
