// @req REQ-2026-022: instance identity/resource migration preserves existing rule regressions.
// @req REQ-2026-015
import { describe, expect, it, vi } from "vitest";
import {
  createRound,
  transition,
  legalActions,
  observeRound,
  DEFAULT_ROUND_RULES,
  snapshotRoundRules,
} from "./index";
import type { RoundCommand, RoundState } from "./types";
import type { NumberValue, PlayerId } from "../types";
import { NUMBER_VALUES, createNumberDeck, numberTotal } from "./numbers";
import { recordTrumpConsumption } from "./turn";
import {
  act,
  fixedRandom,
  fixedRound,
  settle,
  cardValues,
  handValues,
} from "./testHelpers";

function conserve(state: RoundState) {
  const cards = [...state.hands.human, ...state.hands.ai, ...state.deck];
  expect(cardValues(cards).sort((a, b) => a - b)).toEqual(NUMBER_VALUES);
  expect(new Set(cards.map((card) => card.instanceId)).size).toBe(11);
}

describe("contest number deck and round creation", () => {
  it("deals alternately with one private first card per player", () => {
    const random = vi.fn(fixedRandom([11, 1, 10, 2, 9]));
    const result = createRound("human", random);
    expect(random).toHaveBeenCalledTimes(10);
    expect(handValues(result.state)).toEqual({ human: [11, 10], ai: [1, 2] });
    expect(result.state.deck[0].value).toBe(9);
    expect(result.state.turn).toEqual({
      player: "human",
      number: 1,
      usedTrump: false,
    });
    expect(result.state.pointTarget).toBe(21);
    expect(result.state.result).toBeNull();
    expect(result.state.revealed).toEqual([]);
    expect(result.events.map((event) => event.type)).toEqual([
      "deal",
      "deal",
      "deal",
      "deal",
    ]);
    expect(result.events.map((event) => event.state.deck.length)).toEqual([
      10, 9, 8, 7,
    ]);
    for (const event of result.events) conserve(event.state);
    expect(
      result.events.slice(0, 3).every((event) => event.state.turn === null),
    ).toBe(true);
    expect(result.events.at(-1)?.state).toBe(result.state);
  });
  it("accepts the lifecycle's AI first player without a second coin flip", () => {
    const result = fixedRound([1, 2, 3, 4], "ai");
    expect(handValues(result.state)).toEqual({ human: [2, 4], ai: [1, 3] });
    expect(result.state.turn?.player).toBe("ai");
    expect(legalActions(observeRound(result.state, "human"))).toEqual([]);
    expect(legalActions(observeRound(result.state, "ai"))).toEqual([
      "Hit",
      "Stay",
    ]);
    expect(
      settle(result.state)
        .events.filter((event) => event.type === "reveal")
        .map((event) => event.player),
    ).toEqual(["ai", "human"]);
  });
  it("uses fixed integer values including 1 and 11, with no ace conversion", () => {
    expect(numberTotal([1, 11, 10])).toBe(22);
    expect(createNumberDeck(fixedRandom([11, 1, 10])).slice(0, 3)).toEqual([
      11, 1, 10,
    ]);
    expect(
      createNumberDeck(() => 0)
        .slice()
        .sort((a, b) => a - b),
    ).toEqual(NUMBER_VALUES);
    expect(createNumberDeck(() => 1 - Number.EPSILON)).toEqual(NUMBER_VALUES);
  });
  it.each([-0.1, 1, Infinity, NaN])(
    "rejects invalid injected random sample %s",
    (sample) => {
      expect(() => createNumberDeck(() => sample)).toThrow(RangeError);
    },
  );
  it("copies mutable rules once and shares a frozen snapshot through every entry", () => {
    const rules = { version: 1 as const, pointTarget: 24 };
    const initial = fixedRound([10, 9, 11, 8], "human", rules);
    rules.pointTarget = 17;
    expect(initial.state.rules.pointTarget).toBe(24);
    expect(initial.state.pointTarget).toBe(24);
    expect(Object.isFrozen(rules)).toBe(false);
    expect(Object.isFrozen(initial.state.rules)).toBe(true);
    const next = act(initial.state, "Stay");
    expect(next.state.rules).toBe(initial.state.rules);
    expect(observeRound(next.state, "human").rules).toBe(initial.state.rules);
    expect(next.events[0].state.rules).toBe(initial.state.rules);
    const snapshot = snapshotRoundRules({ version: 1, pointTarget: 21 });
    expect(fixedRound([], "human", snapshot).state.rules).toBe(snapshot);
    expect(DEFAULT_ROUND_RULES.pointTarget).toBe(21);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid point target %s before consuming randomness",
    (pointTarget) => {
      const random = vi.fn(() => 0);
      expect(() =>
        createRound("human", random, { version: 1, pointTarget }),
      ).toThrow(RangeError);
      expect(random).not.toHaveBeenCalled();
    },
  );
  it("rejects unknown rules versions and first players before the shuffle", () => {
    const random = vi.fn(() => 0);
    expect(() =>
      createRound("human", random, { version: 2, pointTarget: 21 } as never),
    ).toThrow(RangeError);
    expect(() => createRound("other" as never, random)).toThrow(RangeError);
    expect(random).not.toHaveBeenCalled();
  });
});

describe("contest turns and quiet stays", () => {
  it("alternates Hit, Stay, Hit and lets a previous stayer decide again", () => {
    const initial = fixedRound([1, 2, 3, 4, 5, 6]).state;
    const first = act(initial, "Stay");
    expect(first.state.quietStays).toBe(1);
    expect(first.state.turn?.player).toBe("ai");
    const second = act(first.state, "Hit");
    expect(cardValues(second.state.hands.ai)).toEqual([2, 4, 5]);
    expect(second.state.quietStays).toBe(0);
    expect(second.state.turn).toEqual({
      player: "human",
      number: 3,
      usedTrump: false,
    });
    expect(legalActions(observeRound(second.state, "human"))).toEqual([
      "Hit",
      "Stay",
    ]);
    const third = act(second.state, "Hit");
    expect(cardValues(third.state.hands.human)).toEqual([1, 3, 6]);
    expect(third.state.turn?.player).toBe("ai");
    expect(first.events.map((event) => event.type)).toEqual(["stay"]);
    expect(second.events.map((event) => event.type)).toEqual(["hit"]);
    expect(cardValues(initial.hands.ai)).toEqual([2, 4]);
    expect(initial.quietStays).toBe(0);
  });
  it("leaves ordinary 21 and busts active, allowing further Hits", () => {
    let state = fixedRound([10, 9, 11, 8, 7, 6, 5]).state;
    expect(numberTotal(state.hands.human)).toBe(21);
    state = act(state, "Hit").state;
    expect(numberTotal(state.hands.human)).toBe(28);
    state = act(state, "Hit").state;
    expect(numberTotal(state.hands.ai)).toBe(23);
    expect(state.phase).toBe("acting");
    expect(state.result).toBeNull();
    expect(legalActions(observeRound(state, "human"))).toContain("Hit");
    expect(cardValues(act(state, "Hit").state.hands.human)).toEqual([
      10, 11, 7, 5,
    ]);
  });
  it("never refills an empty pile; rejects Hit but still settles via Stay", () => {
    let state = fixedRound([]).state;
    for (let i = 0; i < 7; i++) state = act(state, "Hit").state;
    expect(state.deck).toEqual([]);
    expect(legalActions(observeRound(state, state.turn!.player))).toEqual([
      "Stay",
    ]);
    const denied = act(state, "Hit");
    expect(denied).toEqual({ state, events: [] });
    expect(denied.state).toBe(state);
    const final = settle(state);
    expect(final.state.phase).toBe("settled");
    expect(final.state.deck).toEqual([]);
    conserve(final.state);
  });
  it("reveals in order then settles exactly once after two quiet Stays", () => {
    const initial = fixedRound([10, 9, 11, 8]).state;
    const first = act(initial, "Stay");
    expect(first.state.phase).toBe("acting");
    expect(first.state.revealed).toEqual([]);
    const final = act(first.state, "Stay");
    expect(final.events.map((event) => event.type)).toEqual([
      "stay",
      "reveal",
      "reveal",
      "settled",
    ]);
    expect(final.events.map((event) => event.state.revealed)).toEqual([
      [],
      ["human"],
      ["human", "ai"],
      ["human", "ai"],
    ]);
    expect(
      final.events.slice(0, 3).every((event) => event.state.result === null),
    ).toBe(true);
    expect(final.state.result).toEqual({
      winner: "human",
      totals: { human: 21, ai: 17 },
      pointTarget: 21,
    });
    expect(final.state.quietStays).toBe(2);
    expect(final.state.turn).toBeNull();
    expect(final.events.at(-1)?.state).toBe(final.state);
    for (const type of ["Hit", "Stay"] as const) {
      const denied = transition(final.state, { type, player: "human" });
      expect(denied.state).toBe(final.state);
      expect(denied.events).toEqual([]);
    }
  });
  it("rejects stale, unknown, non-acting and unsupported commands without state or random changes", () => {
    const random = vi.fn(fixedRandom([1, 2, 3, 4]));
    const initial = createRound("human", random);
    const unchanged = JSON.stringify(initial);
    const invalid = [
      { type: "Hit", player: "ai" },
      { type: "Stay", player: "ai" },
      { type: "Stay", player: "other" },
      { type: "Double", player: "human" },
      { type: "PlayTrump", player: "human" },
    ] as unknown as RoundCommand[];
    for (const command of invalid) {
      const result = transition(initial.state, command);
      expect(result.state).toBe(initial.state);
      expect(result.events).toEqual([]);
    }
    const after = act(initial.state, "Stay");
    expect(
      transition(after.state, { type: "Hit", player: "human" }).state,
    ).toBe(after.state);
    const closing = act(after.state, "Stay");
    for (const event of [
      ...initial.events.slice(0, 3),
      ...closing.events.slice(0, 3),
    ]) {
      expect(legalActions(observeRound(event.state, "human"))).toEqual([]);
      expect(
        transition(event.state, { type: "Stay", player: "human" }).state,
      ).toBe(event.state);
    }
    expect(random).toHaveBeenCalledTimes(10);
    expect(JSON.stringify(initial)).toBe(unchanged);
  });
  it("freezes authoritative state and prior event snapshots against consumer mutation", () => {
    const initial = fixedRound([1, 2, 3, 4]);
    const prior = JSON.stringify(initial);
    const next = act(initial.state, "Hit");
    expect(() =>
      (initial.state.hands.human as unknown as number[]).push(11),
    ).toThrow();
    expect(() =>
      (initial.state.deck as unknown as number[]).reverse(),
    ).toThrow();
    expect(() =>
      Object.assign(initial.state.turn!, { player: "ai" }),
    ).toThrow();
    expect(JSON.stringify(initial)).toBe(prior);
    expect(next.state).not.toBe(initial.state);
    for (const event of next.events) conserve(event.state);
  });
  it("records validated consumption without changing turn, and non-quiet Stay cannot finish the round", () => {
    const initial = fixedRound([]).state;
    const stayed = act(initial, "Stay").state;
    const consumed = recordTrumpConsumption(stayed, "ai");
    expect(consumed.quietStays).toBe(0);
    expect(consumed.turn).toEqual({ player: "ai", number: 2, usedTrump: true });
    expect(recordTrumpConsumption(consumed, "ai").turn).toEqual(consumed.turn);
    expect(recordTrumpConsumption(consumed, "human")).toBe(consumed);
    const first = act(consumed, "Stay");
    expect(first.events[0]).toMatchObject({ type: "stay", quiet: false });
    expect(first.state.quietStays).toBe(0);
    expect(first.state.turn?.usedTrump).toBe(false);
    const second = act(first.state, "Stay");
    expect(second.state.phase).toBe("acting");
    expect(second.state.quietStays).toBe(1);
    const final = act(second.state, "Stay");
    expect(final.state.phase).toBe("settled");
    expect(recordTrumpConsumption(final.state, "ai")).toBe(final.state);
    expect(stayed.turn?.usedTrump).toBe(false);
  });
  it("clears the consumed marker and quiet record on Hit", () => {
    const original = act(fixedRound([]).state, "Stay").state;
    const consumed = recordTrumpConsumption(original, "ai");
    const hit = act(consumed, "Hit");
    expect(hit.state.quietStays).toBe(0);
    expect(hit.state.turn).toEqual({
      player: "human",
      number: 3,
      usedTrump: false,
    });
  });
  it("conserves every number in all snapshots across 300 seeded command streams", () => {
    for (let seed = 1; seed <= 300; seed++) {
      let value = seed;
      const random = () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 0x100000000;
      };
      const initial = createRound(seed % 2 ? "human" : "ai", random);
      let state = initial.state;
      for (const event of initial.events) conserve(event.state);
      let commands = 0;
      while (state.phase === "acting" && commands < 30) {
        const previous = JSON.stringify(state);
        const result = act(
          state,
          state.deck.length > 0 && random() < 0.7 ? "Hit" : "Stay",
        );
        expect(JSON.stringify(state)).toBe(previous);
        state = result.state;
        for (const event of result.events) conserve(event.state);
        commands++;
      }
      expect(state.phase).toBe("settled");
      expect(state.revealed).toHaveLength(2);
      conserve(state);
    }
  });
});

describe("contest face comparison through authoritative commands", () => {
  it.each<{
    name: string;
    cards: NumberValue[];
    hits: number;
    winner: PlayerId | null;
    totals: [number, number];
    target?: number;
  }>([
    {
      name: "both safe, human higher",
      cards: [9, 8, 10, 7],
      hits: 0,
      winner: "human",
      totals: [19, 15],
    },
    {
      name: "both safe, AI higher",
      cards: [7, 9, 8, 10],
      hits: 0,
      winner: "ai",
      totals: [15, 19],
    },
    {
      name: "safe tie",
      cards: [10, 9, 5, 6],
      hits: 0,
      winner: null,
      totals: [15, 15],
    },
    {
      name: "human alone busts",
      cards: [10, 9, 11, 8, 1],
      hits: 1,
      winner: "ai",
      totals: [22, 17],
    },
    {
      name: "AI alone busts",
      cards: [10, 9, 11, 8, 1, 6],
      hits: 2,
      winner: "human",
      totals: [22, 23],
      target: 22,
    },
    {
      name: "both bust, human lower",
      cards: [10, 9, 8, 11, 4, 5],
      hits: 2,
      winner: "human",
      totals: [22, 25],
    },
    {
      name: "both bust, AI lower",
      cards: [9, 10, 11, 8, 5, 4],
      hits: 2,
      winner: "ai",
      totals: [25, 22],
    },
    {
      name: "both bust, equal totals",
      cards: [10, 11, 8, 9, 4, 2],
      hits: 2,
      winner: null,
      totals: [22, 22],
    },
    {
      name: "a higher target makes 22 safe",
      cards: [10, 9, 11, 8, 1],
      hits: 1,
      winner: "human",
      totals: [22, 17],
      target: 24,
    },
  ])("$name", ({ cards, hits, winner, totals, target }) => {
    let state = fixedRound(cards, "human", {
      version: 1,
      pointTarget: target ?? 21,
    }).state;
    for (let i = 0; i < hits; i++) state = act(state, "Hit").state;
    const final = settle(state);
    expect(final.state.result).toEqual({
      winner,
      totals: { human: totals[0], ai: totals[1] },
      pointTarget: target ?? 21,
    });
    expect(
      final.events.filter((event) => event.type === "settled"),
    ).toHaveLength(1);
  });
  it("compares against a lower frozen target instead of the classic 21", () => {
    const state = fixedRound([10, 11, 8, 9], "human", {
      version: 1,
      pointTarget: 17,
    }).state;
    expect(settle(state).state.result).toEqual({
      winner: "human",
      totals: { human: 18, ai: 20 },
      pointTarget: 17,
    });
  });
  it("lets a safe player beat an AI bust at the default target", () => {
    let state = fixedRound([10, 9, 11, 8, 6]).state;
    state = act(state, "Stay").state;
    state = act(state, "Hit").state;
    expect(settle(state).state.result).toEqual({
      winner: "human",
      totals: { human: 21, ai: 23 },
      pointTarget: 21,
    });
  });
  it("treats a two-card 21 and a later three-card 21 as an ordinary tie", () => {
    let state = fixedRound([10, 9, 11, 8, 4]).state;
    state = act(state, "Stay").state;
    state = act(state, "Hit").state;
    expect(state.phase).toBe("acting");
    expect(settle(state).state.result?.winner).toBeNull();
  });
});
