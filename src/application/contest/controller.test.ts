// @req REQ-2026-017: real engine + fake time; no UI or persistence adapter.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMatch,
  legalMatchActions,
  observeMatch,
  transitionMatch,
} from "../../domain/contest/engine";
import type { NumberValue, PlayerId } from "../../domain/contest/types";
import { fixedRandom } from "../../domain/contest/engine/testHelpers";
import { createContestController } from "./controller";
import { baselinePolicy } from "../../domain/contest/ai/policy";
import type { ContestView, OpponentPolicy } from "./types";

function samplesForRound(prefix: readonly NumberValue[]) {
  const shuffle = fixedRandom(prefix);
  return Array.from({ length: 10 }, () => shuffle());
}
function sequence(samples: readonly number[]) {
  let index = 0;
  return vi.fn(() => {
    if (index === samples.length) throw new Error("Unexpected deal randomness");
    return samples[index++];
  });
}
const humanRound = (prefix: readonly NumberValue[] = [10, 8, 11, 9]) =>
  sequence([0.25, ...samplesForRound(prefix)]);
const aiRound = (prefix: readonly NumberValue[] = [8, 10, 9, 11]) =>
  sequence([0.75, ...samplesForRound(prefix)]);
function assertNoDeck(value: unknown) {
  if (value !== null && typeof value === "object") {
    expect(Object.keys(value)).not.toContain("deck");
    for (const child of Object.values(value)) assertNoDeck(child);
  }
}
function finishFromAiStay() {
  const random = aiRound();
  const controller = createContestController({ random });
  controller.start();
  vi.runAllTimers();
  expect(controller.snapshot()?.round.turn?.player).toBe("human");
  expect(controller.snapshot()?.round.quietStays).toBe(1);
  return { controller, random };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("private authority and projected replay", () => {
  it("starts idle without reading storage or consuming deal randomness", () => {
    const random = vi.fn(() => 0);
    const controller = createContestController({ random });
    expect(controller.getSnapshot()).toEqual({
      match: null,
      busy: false,
      thinking: false,
      paused: false,
      event: null,
      effectId: 0,
      actions: [],
    });
    expect(controller.snapshot()).toBeNull();
    expect(random).not.toHaveBeenCalled();
    expect(controller.send("Stay")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("commits the round score before the first result animation and blocks double submits", () => {
    const { controller, random } = finishFromAiStay();
    const previousEffects = controller.getSnapshot().effectId;
    expect(controller.send("Stay")).toBe(true);
    expect(controller.snapshot()?.game.points.human).toBe(1);
    expect(controller.snapshot()?.phase).toBe("round-complete");
    expect(controller.getSnapshot().match?.game.points.human).toBe(0);
    expect(controller.getSnapshot().busy).toBe(true);
    expect(controller.getSnapshot().actions).toEqual([]);
    expect(controller.send("Stay")).toBe(false);
    expect(controller.send("NextRound")).toBe(false);
    vi.runAllTimers();
    expect(controller.getSnapshot().match).toEqual(controller.snapshot());
    expect(controller.getSnapshot().match?.game.points.human).toBe(1);
    expect(controller.getSnapshot().effectId).toBe(previousEffects + 6);
    expect(controller.getSnapshot().actions).toEqual(["NextRound"]);
    expect(random).toHaveBeenCalledTimes(11);
  });
  it("skips replay without changing the committed result or repeating score events", () => {
    const { controller } = finishFromAiStay();
    controller.send("Stay");
    const committed = controller.snapshot();
    controller.skipAnimations();
    expect(controller.snapshot()).toEqual(committed);
    expect(controller.getSnapshot().match).toEqual(committed);
    expect(controller.getSnapshot().busy).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(controller.snapshot()?.game.points.human).toBe(1);
  });
  it("publishes projected events and gives the strategy only its own observation and Hit/Stay", () => {
    const observed: ContestView[] = [];
    const events: unknown[] = [];
    const random = aiRound();
    const opponent: OpponentPolicy = vi.fn((view, actions) => {
      assertNoDeck(view);
      expect(view.round.hands.ai.cards[0].value).toBe(8);
      expect(view.round.hands.human.cards[0].value).toBeNull();
      expect(view.round.hands.human.total).toBeNull();
      expect(actions).toEqual(["Hit", "Stay"]);
      return baselinePolicy(view, actions);
    });
    const controller = createContestController({
      random,
      opponent,
      onEvent: (event) => events.push(event),
    });
    controller.subscribe(() => observed.push(controller.getSnapshot()));
    controller.start();
    vi.runAllTimers();
    for (const value of [...observed, ...events, controller.snapshot()])
      assertNoDeck(value);
    for (const view of observed) {
      if (view.match?.round.hands.ai.cards.length)
        expect(view.match.round.hands.ai.cards[0].value).toBeNull();
    }
    expect(opponent).toHaveBeenCalledTimes(1);
    expect((opponent as ReturnType<typeof vi.fn>).mock.calls[0]).toHaveLength(
      2,
    );
    expect(random).toHaveBeenCalledTimes(11);
  });
  it("uses increasing effect IDs for identical events, including across restarts", () => {
    const random = sequence([
      0.25,
      ...samplesForRound([10, 8, 11, 9]),
      0.25,
      ...samplesForRound([10, 8, 11, 9]),
    ]);
    const ids: number[] = [];
    const controller = createContestController({
      random,
      reducedMotion: true,
      onEvent: () => ids.push(controller.getSnapshot().effectId),
    });
    controller.start();
    vi.advanceTimersByTime(139);
    expect(controller.getSnapshot().busy).toBe(true);
    expect(ids).toEqual([1, 2, 3, 4]);
    vi.advanceTimersByTime(1);
    expect(controller.getSnapshot().busy).toBe(false);
    controller.restart();
    vi.runAllTimers();
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("reads a changed reduced-motion preference for the next queued delay", () => {
    const controller = createContestController({ random: humanRound() });
    controller.start();
    controller.setReducedMotion(true);
    vi.advanceTimersByTime(220 + 35 + 35 + 34);
    expect(controller.getSnapshot().busy).toBe(true);
    vi.advanceTimersByTime(1);
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().effectId).toBe(4);
  });
});

describe("opponent scheduling and decisions", () => {
  it("waits until replay finishes and the opponent delay expires", () => {
    const opponent = vi.fn(baselinePolicy);
    const controller = createContestController({ random: aiRound(), opponent });
    controller.start();
    expect(controller.send("Stay")).toBe(false);
    vi.advanceTimersByTime(879);
    expect(controller.getSnapshot().thinking).toBe(false);
    expect(opponent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(controller.getSnapshot().thinking).toBe(true);
    expect(controller.getSnapshot().actions).toEqual([]);
    expect(controller.send("Stay")).toBe(false);
    vi.advanceTimersByTime(299);
    expect(opponent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(opponent).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()?.round.turn?.player).toBe("human");
    vi.runAllTimers();
    expect(controller.getSnapshot().actions).toEqual(["Hit", "Stay"]);
  });
  it("does not call the opponent while the human owns the turn", () => {
    const opponent = vi.fn(baselinePolicy);
    const controller = createContestController({
      random: humanRound(),
      opponent,
    });
    expect(controller.start()).toBe(true);
    expect(controller.start()).toBe(false);
    vi.runAllTimers();
    expect(opponent).not.toHaveBeenCalled();
    expect(controller.getSnapshot().actions).toEqual(["Hit", "Stay"]);
  });
  it("lets a previous stayer decide again after the opponent Hits", () => {
    const opponent = vi.fn(baselinePolicy);
    const controller = createContestController({
      random: humanRound([10, 7, 11, 9, 1]),
      opponent,
    });
    controller.start();
    vi.runAllTimers();
    controller.send("Stay");
    vi.runAllTimers();
    expect(controller.snapshot()?.round.hands.ai.cards).toHaveLength(3);
    expect(controller.snapshot()?.round.quietStays).toBe(0);
    expect(controller.snapshot()?.round.turn?.player).toBe("human");
    expect(controller.getSnapshot().actions).toContain("Stay");
    controller.send("Stay");
    vi.runAllTimers();
    expect(opponent.mock.results.map((result) => result.value)).toEqual([
      "Hit",
      "Stay",
    ]);
    expect(controller.snapshot()?.phase).toBe("round-complete");
    expect(controller.snapshot()?.game.points.human).toBe(1);
  });
  it("calls a previously staying opponent again after a human Hit, even at 21 or bust", () => {
    const opponent = vi.fn(baselinePolicy);
    const controller = createContestController({
      random: aiRound([8, 10, 9, 11, 1]),
      opponent,
    });
    controller.start();
    vi.runAllTimers();
    expect(controller.snapshot()?.round.hands.human.total).toBe(21);
    controller.send("Hit");
    vi.runAllTimers();
    expect(controller.snapshot()?.round.hands.human.total).toBe(22);
    expect(controller.snapshot()?.phase).toBe("playing");
    expect(controller.snapshot()?.round.turn?.player).toBe("human");
    expect(opponent).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().actions).toContain("Stay");
  });
  it.each([
    { prefix: [6, 11, 10, 9], total: 16, action: "Hit" },
    { prefix: [8, 10, 9, 11], total: 17, action: "Stay" },
    { prefix: [10, 8, 11, 9], total: 21, action: "Stay" },
  ] as const)(
    "chooses $action at $total without using a random source",
    ({ prefix, total, action }) => {
      const random = aiRound(prefix);
      const state = createMatch(random).state;
      const view = observeMatch(state, "ai");
      expect(view.round.hands.ai.total).toBe(total);
      expect(baselinePolicy(view, ["Hit", "Stay"])).toBe(action);
      expect(random).toHaveBeenCalledTimes(11);
    },
  );
  it("Stays when busted, with ordinary Hit still legal", () => {
    const random = aiRound([10, 8, 11, 9, 1]);
    let state = createMatch(random).state;
    state = transitionMatch(
      state,
      { type: "Hit", player: "ai", roundNumber: 1 },
      random,
    ).state;
    state = transitionMatch(
      state,
      { type: "Stay", player: "human", roundNumber: 1 },
      random,
    ).state;
    const view = observeMatch(state, "ai");
    expect(view.round.hands.ai.total).toBe(22);
    expect(legalMatchActions(view)).toContain("Hit");
    expect(baselinePolicy(view, ["Hit", "Stay"])).toBe("Stay");
  });
  it("Stays at 16 when the shared pile is empty", () => {
    const random = humanRound([5, 1, 7, 2, 8, 3, 9, 4, 10, 6, 11]);
    let state = createMatch(random).state;
    for (let i = 0; i < 7; i++)
      state = transitionMatch(
        state,
        { type: "Hit", player: state.round.turn!.player, roundNumber: 1 },
        random,
      ).state;
    const view = observeMatch(state, "ai");
    expect(view.round.hands.ai.total).toBe(16);
    expect(view.round.deckCount).toBe(0);
    expect(legalMatchActions(view)).toEqual(["Stay"]);
    expect(baselinePolicy(view, ["Stay"])).toBe("Stay");
  });
});

describe("cancellation, pause and restart", () => {
  // @req REQ-2026-020: force delivery after cancellation, not just clearTimeout.
  it.each(["pause", "exit"] as const)(
    "rejects a stale AI decision after %s and resumes at most once",
    (interruption) => {
      const scheduled = vi.spyOn(globalThis, "setTimeout");
      const opponent = vi.fn(baselinePolicy);
      const random = aiRound();
      const controller = createContestController({ random, opponent });
      controller.start();
      controller.skipAnimations();
      const stale = scheduled.mock.calls.at(-1)![0] as () => void;
      controller[interruption]();
      stale();
      vi.runAllTimers();
      expect(opponent).not.toHaveBeenCalled();
      expect(random).toHaveBeenCalledTimes(11);
      if (interruption === "pause") {
        controller.resume();
        controller.resume();
        vi.advanceTimersByTime(300);
        expect(opponent).toHaveBeenCalledTimes(1);
        const committed = controller.snapshot();
        controller.skipAnimations();
        stale();
        vi.runAllTimers();
        expect(controller.snapshot()).toEqual(committed);
        expect(opponent).toHaveBeenCalledTimes(1);
      } else {
        expect(controller.snapshot()).toBeNull();
      }
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("cancels replay on exit and ignores a late callback from the abandoned match", () => {
    const scheduled = vi.spyOn(globalThis, "setTimeout");
    const random = humanRound();
    const controller = createContestController({ random });
    controller.start();
    const stale = scheduled.mock.calls[0][0] as () => void;
    controller.exit();
    expect(controller.snapshot()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    stale();
    vi.runAllTimers();
    expect(controller.getSnapshot().match).toBeNull();
    expect(controller.getSnapshot().busy).toBe(false);
    expect(random).toHaveBeenCalledTimes(11);
  });
  it("invalidates delayed AI on restart, even if the canceled callback is delivered", () => {
    const random = sequence([
      0.75,
      ...samplesForRound([8, 10, 9, 11]),
      0.25,
      ...samplesForRound([10, 8, 11, 9]),
    ]);
    const scheduled = vi.spyOn(globalThis, "setTimeout");
    const opponent = vi.fn(baselinePolicy);
    const controller = createContestController({ random, opponent });
    controller.start();
    controller.skipAnimations();
    const stale = scheduled.mock.calls.at(-1)![0] as () => void;
    expect(controller.getSnapshot().thinking).toBe(true);
    controller.restart();
    stale();
    vi.runAllTimers();
    expect(opponent).not.toHaveBeenCalled();
    expect(controller.snapshot()?.round.firstPlayer).toBe("human");
    expect(controller.snapshot()?.round.quietStays).toBe(0);
    expect(controller.snapshot()?.game.points).toEqual({ human: 0, ai: 0 });
    expect(random).toHaveBeenCalledTimes(22);
  });
  it("leaves no timer when a subscriber exits during the AI notification", () => {
    const opponent = vi.fn(baselinePolicy);
    const controller = createContestController({ random: aiRound(), opponent });
    controller.subscribe(() => {
      if (controller.getSnapshot().thinking) controller.exit();
    });
    controller.start();
    controller.skipAnimations();
    expect(controller.getSnapshot().match).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(opponent).not.toHaveBeenCalled();
  });
  // @req REQ-2026-020: interruption can occur synchronously inside publish.
  it("pauses inside the AI notification, rejects old callbacks and resumes once", () => {
    const scheduled = vi.spyOn(globalThis, "setTimeout");
    const opponent = vi.fn(baselinePolicy);
    const random = aiRound();
    const controller = createContestController({ random, opponent });
    controller.start();
    const staleReplay = scheduled.mock.calls.at(-1)![0] as () => void;
    let shouldPause = true;
    controller.subscribe(() => {
      if (shouldPause && controller.getSnapshot().thinking) {
        shouldPause = false;
        controller.pause();
      }
    });
    controller.skipAnimations();
    const committed = controller.snapshot();
    expect(controller.getSnapshot().paused).toBe(true);
    expect(controller.getSnapshot().thinking).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(controller.send("Stay")).toBe(false);
    staleReplay();
    vi.runAllTimers();
    expect(controller.snapshot()).toEqual(committed);
    expect(opponent).not.toHaveBeenCalled();
    controller.resume();
    const staleDecision = scheduled.mock.calls.at(-1)![0] as () => void;
    controller.pause();
    staleDecision();
    expect(opponent).not.toHaveBeenCalled();
    controller.resume();
    controller.resume();
    vi.runAllTimers();
    expect(opponent).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()?.round.turn?.player).toBe("human");
    expect(random).toHaveBeenCalledTimes(11);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("leaves no replay timer when an event callback exits", () => {
    const controller = createContestController({
      random: humanRound(),
      onEvent: () => controller.exit(),
    });
    controller.start();
    expect(controller.getSnapshot().match).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("pause preserves a committed score and resumes at the next-round decision", () => {
    const { controller } = finishFromAiStay();
    controller.send("Stay");
    const committed = controller.snapshot();
    controller.pause();
    expect(controller.getSnapshot().paused).toBe(true);
    expect(controller.getSnapshot().match).toEqual(committed);
    expect(controller.send("NextRound")).toBe(false);
    vi.runAllTimers();
    controller.resume();
    expect(controller.snapshot()).toEqual(committed);
    expect(controller.getSnapshot().paused).toBe(false);
    expect(controller.getSnapshot().actions).toEqual(["NextRound"]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("pauses AI thinking, then resumes one decision for the committed actor", () => {
    const opponent = vi.fn(baselinePolicy);
    const controller = createContestController({ random: aiRound(), opponent });
    controller.start();
    controller.skipAnimations();
    controller.pause();
    vi.advanceTimersByTime(10000);
    expect(opponent).not.toHaveBeenCalled();
    expect(controller.getSnapshot().busy).toBe(false);
    controller.resume();
    expect(controller.getSnapshot().thinking).toBe(true);
    vi.runAllTimers();
    expect(opponent).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()?.round.turn?.player).toBe("human");
    expect(controller.getSnapshot().actions).toEqual(["Hit", "Stay"]);
  });
  it("resumes a human-owned turn without scheduling an opponent or switching actors", () => {
    const opponent = vi.fn(baselinePolicy);
    const controller = createContestController({
      random: humanRound(),
      opponent,
    });
    controller.start();
    controller.pause();
    const committed = controller.snapshot();
    expect(controller.send("Stay")).toBe(false);
    controller.resume();
    vi.runAllTimers();
    expect(controller.snapshot()).toEqual(committed);
    expect(controller.snapshot()?.round.turn?.player).toBe("human");
    expect(controller.getSnapshot().actions).toEqual(["Hit", "Stay"]);
    expect(opponent).not.toHaveBeenCalled();
  });
  it("removes subscriptions and starts fresh after exiting", () => {
    const random = sequence([
      0.25,
      ...samplesForRound([10, 8, 11, 9]),
      0.25,
      ...samplesForRound([10, 8, 11, 9]),
    ]);
    const controller = createContestController({ random });
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    controller.start();
    unsubscribe();
    const calls = listener.mock.calls.length;
    vi.runAllTimers();
    controller.exit();
    controller.start();
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(calls);
    expect(controller.snapshot()?.game.points).toEqual({ human: 0, ai: 0 });
    expect(controller.snapshot()?.roundNumber).toBe(1);
  });
});

describe("complete BO5 and storage isolation", () => {
  it.each(["human", "ai"] as const)(
    "completes a no-trump 3:0 for %s through the public application API",
    (winner) => {
      const samples = [0.25];
      for (let i = 0; i < 15; i++) {
        const first: PlayerId = i % 2 === 0 ? "human" : "ai";
        const hands: Record<PlayerId, NumberValue[]> =
          winner === "human"
            ? { human: [10, 11], ai: [8, 9] }
            : { human: [8, 9], ai: [10, 11] };
        const other = first === "human" ? "ai" : "human";
        samples.push(
          ...samplesForRound([
            hands[first][0],
            hands[other][0],
            hands[first][1],
            hands[other][1],
          ]),
        );
      }
      const random = sequence(samples);
      const opponent = vi.fn(baselinePolicy);
      // @req REQ-2026-020: cover every Storage method and the length getter.
      const storageMethods = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
      };
      const readLength = vi.fn(() => 0);
      vi.stubGlobal("localStorage", {
        ...storageMethods,
        get length() {
          return readLength();
        },
      });
      const controller = createContestController({ random, opponent });
      controller.start();
      vi.runAllTimers();
      for (let i = 0; i < 15; i++) {
        expect(controller.getSnapshot().actions).toContain("Stay");
        expect(controller.send("Stay")).toBe(true);
        expect(controller.send("Stay")).toBe(false);
        vi.runAllTimers();
        expect(controller.snapshot()?.roundNumber).toBe(i + 1);
        if (i < 14) {
          expect(controller.getSnapshot().actions).toEqual(["NextRound"]);
          controller.send("NextRound");
          vi.runAllTimers();
        }
      }
      expect(controller.snapshot()?.phase).toBe("complete");
      expect(controller.snapshot()?.winner).toBe(winner);
      expect(controller.snapshot()?.wins).toEqual({
        human: winner === "human" ? 3 : 0,
        ai: winner === "ai" ? 3 : 0,
      });
      expect(controller.getSnapshot().actions).toEqual([]);
      expect(controller.getSnapshot().busy).toBe(false);
      expect(controller.send("NextRound")).toBe(false);
      const decisions = opponent.mock.calls.length;
      vi.runAllTimers();
      expect(opponent).toHaveBeenCalledTimes(decisions);
      expect(opponent).toHaveBeenCalledTimes(15);
      expect(random).toHaveBeenCalledTimes(151);
      expect(vi.getTimerCount()).toBe(0);
      for (const method of Object.values(storageMethods))
        expect(method).not.toHaveBeenCalled();
      expect(readLength).not.toHaveBeenCalled();
    },
  );
});
