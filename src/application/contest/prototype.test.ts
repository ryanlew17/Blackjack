// @req REQ-2026-019: explicit two-player commands through the real coordinator.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContestCoordinator } from "./coordinator";
import { createContestController } from "./controller";
import {
  PROTOTYPE_RULES,
  prototypeSetup,
} from "../../domain/contest/engine/prototype";
import { fixedRandom } from "../../domain/contest/engine/testHelpers";
import type { MatchEventView } from "../../domain/contest/engine";

function coordinator(first: "human" | "ai" = "human") {
  const shuffle = fixedRandom(
    first === "human" ? [10, 8, 11, 9] : [8, 10, 9, 11],
  );
  let coin = true;
  const random = vi.fn(() => {
    if (coin) {
      coin = false;
      return first === "human" ? 0.25 : 0.75;
    }
    return shuffle();
  });
  const events: MatchEventView[] = [];
  const opponent = vi.fn(() => "Stay" as const);
  const api = createContestCoordinator({
    random,
    opponent,
    roundRules: PROTOTYPE_RULES,
    trumpSetup: prototypeSetup(
      ["test-draw-2", "test-return", "test-mixed"],
      ["test-target-17", "test-dispel"],
    ),
    controlledPlayers: ["human", "ai"],
    onEvent: (e) => events.push(e),
  });
  api.start();
  vi.runAllTimers();
  return { api, events, opponent, random };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("scripted multi-trump replay", () => {
  it("commits before replay and restores the same human actor after every card", () => {
    const { api, events, opponent, random } = coordinator();
    for (const [index, total] of [
      [0, 23],
      [1, 21],
      [2, 24],
    ]) {
      const oldEffects = api.getSnapshot().effectId;
      expect(
        api.sendCommand({
          type: "PlayTrump",
          player: "human",
          instanceId: `human-${index}`,
        }),
      ).toBe(true);
      expect(api.snapshot()?.round.hands.human.total).toBe(total);
      expect(api.snapshot()?.round.turn).toEqual({
        player: "human",
        number: 1,
        usedTrump: true,
      });
      expect(api.getSnapshot().busy).toBe(true);
      expect(api.getSnapshot().actions).toEqual([]);
      expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(false);
      expect(
        api.sendCommand({
          type: "PlayTrump",
          player: "human",
          instanceId: `human-${index}`,
        }),
      ).toBe(false);
      vi.runAllTimers();
      expect(api.getSnapshot().busy).toBe(false);
      expect(api.getSnapshot().match).toEqual(api.snapshot());
      expect(api.getSnapshot().actions).toContain("Stay");
      expect(api.getSnapshot().effectId).toBeGreaterThan(oldEffects);
    }
    expect(opponent).not.toHaveBeenCalled();
    expect(random).toHaveBeenCalledTimes(11);
    expect(
      events
        .filter((e) => e.type === "round" && e.event.type === "trump")
        .every((e) => e.state.round.turn?.player === "human"),
    ).toBe(true);
    api.sendCommand({ type: "Stay", player: "human" });
    vi.runAllTimers();
    expect(api.snapshot()?.round.turn?.player).toBe("ai");
    expect(
      api.sendCommand({
        type: "PlayTrump",
        player: "ai",
        instanceId: "ai-1",
        targetId: "human-2",
      }),
    ).toBe(true);
    expect(api.snapshot()?.round.pointTarget).toBe(21);
    expect(api.getSnapshot().busy).toBe(true);
    vi.runAllTimers();
    expect(api.snapshot()?.round.turn?.player).toBe("ai");
    expect(api.getSnapshot().thinking).toBe(false);
    expect(api.sendCommand({ type: "Stay", player: "ai" })).toBe(true);
    vi.runAllTimers();
    expect(api.snapshot()?.phase).toBe("playing");
    api.sendCommand({ type: "Stay", player: "human" });
    vi.runAllTimers();
    expect(api.snapshot()?.phase).toBe("playing");
    api.sendCommand({ type: "Stay", player: "ai" });
    expect(api.snapshot()?.game.points.ai).toBe(1);
    expect(api.getSnapshot().match?.game.points.ai).toBe(0);
    vi.runAllTimers();
    expect(api.getSnapshot().match?.game.points.ai).toBe(1);
  });
  it("restores the same explicitly controlled AI after a card without calling the strategy", () => {
    const { api, opponent } = coordinator("ai");
    api.sendCommand({ type: "PlayTrump", player: "ai", instanceId: "ai-0" });
    expect(api.snapshot()?.round.pointTarget).toBe(17);
    vi.runAllTimers();
    expect(api.getSnapshot().match?.round.turn?.player).toBe("ai");
    expect(api.getSnapshot().busy).toBe(false);
    expect(opponent).not.toHaveBeenCalled();
    expect(api.sendCommand({ type: "Stay", player: "ai" })).toBe(true);
    vi.runAllTimers();
    expect(api.snapshot()?.round.turn?.player).toBe("human");
  });
  it("pause/skip never rolls back a mixed effect or hands over its turn", () => {
    const { api } = coordinator();
    api.sendCommand({
      type: "PlayTrump",
      player: "human",
      instanceId: "human-2",
    });
    const committed = api.snapshot();
    api.pause();
    vi.runAllTimers();
    expect(api.snapshot()).toEqual(committed);
    expect(api.getSnapshot().match).toEqual(committed);
    expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(false);
    api.resume();
    expect(api.getSnapshot().actions).toContain("Stay");
    expect(api.snapshot()?.round.turn?.player).toBe("human");
    api.sendCommand({
      type: "PlayTrump",
      player: "human",
      instanceId: "human-0",
    });
    api.skipAnimations();
    const skipped = api.snapshot();
    vi.runAllTimers();
    expect(api.getSnapshot().match).toEqual(skipped);
    expect(api.snapshot()?.round.turn?.player).toBe("human");
    expect(api.snapshot()?.round.hands.human.total).toBe(26);
  });
  it("exit cancels every remaining mixed-effect frame", () => {
    const { api, events } = coordinator();
    api.sendCommand({
      type: "PlayTrump",
      player: "human",
      instanceId: "human-2",
    });
    const count = events.length;
    api.exit();
    vi.runAllTimers();
    expect(events).toHaveLength(count);
    expect(api.snapshot()).toBeNull();
    expect(api.getSnapshot().match).toBeNull();
  });
  it("keeps the production controller human-only with no prototype setup or command port", () => {
    const controller = createContestController();
    expect(controller).not.toHaveProperty("sendCommand");
    expect(controller.send("PlayTrump" as never)).toBe(false);
    expect(controller.getSnapshot().actions).toEqual([]);
  });
});

it("the automatic placeholder keeps its held trumps and uses only Hit/Stay", () => {
  const shuffle = fixedRandom([8, 10, 9, 11]);
  let coin = true;
  const random = () => {
    if (coin) {
      coin = false;
      return 0.75;
    }
    return shuffle();
  };
  const api = createContestCoordinator({
    random,
    roundRules: PROTOTYPE_RULES,
    trumpSetup: prototypeSetup([], ["test-draw-2"]),
  });
  api.start();
  vi.runAllTimers();
  expect(api.snapshot()?.round.turn?.player).toBe("human");
  expect(api.snapshot()?.round.trumps?.opponentHandCount).toBe(1);
  expect(api.snapshot()?.round.trumps?.discarded).toEqual([]);
  expect(api.snapshot()?.round.hands.ai.cards).toHaveLength(2);
});

it("restart replaces the prototype match and invalidates its pending mixed-effect frames", () => {
  const events: MatchEventView[] = [];
  const api = createContestCoordinator({
    random: () => 0.25,
    roundRules: PROTOTYPE_RULES,
    trumpSetup: prototypeSetup(["test-mixed"]),
    controlledPlayers: ["human", "ai"],
    onEvent: (e) => events.push(e),
  });
  api.start();
  vi.runAllTimers();
  api.sendCommand({
    type: "PlayTrump",
    player: "human",
    instanceId: "human-0",
  });
  expect(api.snapshot()?.round.pointTarget).toBe(24);
  const before = events.length;
  api.restart();
  vi.runAllTimers();
  expect(
    events
      .slice(before)
      .every((e) => e.type === "round" && e.event.type === "deal"),
  ).toBe(true);
  expect(api.snapshot()?.round.pointTarget).toBe(21);
  expect(api.snapshot()?.round.trumps?.ownHand).toHaveLength(1);
  expect(api.snapshot()?.round.trumps?.table).toEqual([]);
  expect(api.snapshot()?.game.points).toEqual({ human: 0, ai: 0 });
});
