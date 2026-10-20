// @req REQ-2026-020: real projections, hidden-state permutations and a pure contract.
import { describe, expect, it, vi } from "vitest";
import { createMatch, legalMatchActions, observeMatch } from "../engine";
import type { MatchState } from "../engine";
import type { NumberValue } from "../types";
import { fixedRandom } from "../engine/testHelpers";
import { PROTOTYPE_RULES, prototypeSetup } from "../engine/prototype";
import { baselinePolicy, type BaselinePolicy } from "./policy";

function match(prefix: readonly NumberValue[], hiddenTrump = "test-draw-2") {
  const shuffle = fixedRandom(prefix);
  let coin = true;
  const random = vi.fn(() => {
    if (coin) {
      coin = false;
      return 0.75;
    }
    return shuffle();
  });
  return {
    random,
    state: createMatch(
      random,
      PROTOTYPE_RULES,
      prototypeSetup([hiddenTrump], ["test-target-24"]),
    ).state,
  };
}
const actions = (state: MatchState) =>
  legalMatchActions(observeMatch(state, "ai")).filter(
    (action): action is "Hit" | "Stay" => action === "Hit" || action === "Stay",
  );

describe("S1 baseline contract", () => {
  it("accepts a projected observation, cannot accept MatchState or return PlayTrump", () => {
    type Input = Parameters<BaselinePolicy>[0];
    const acceptsState: MatchState extends Input ? true : false = false;
    const playsTrump: "PlayTrump" extends ReturnType<BaselinePolicy>
      ? true
      : false = false;
    expect(acceptsState).toBe(false);
    expect(playsTrump).toBe(false);
  });
  it("Stays below 17 when Hit is disabled, even while holding a usable trump", () => {
    const { state } = match([7, 1, 9, 10]);
    const observation = observeMatch(state, "ai");
    expect(observation.round.hands.ai.total).toBe(16);
    expect(legalMatchActions(observation)).toContain("PlayTrump");
    expect(baselinePolicy(observation, ["Stay"])).toBe("Stay");
  });
  it.each([
    { prefix: [7, 1, 9, 10], target: 17, expected: "Hit" },
    { prefix: [8, 1, 9, 10], target: 24, expected: "Stay" },
  ] as const)(
    "keeps the simple threshold at target $target rather than using special engine permissions",
    ({ prefix, target, expected }) => {
      const { state } = match(prefix);
      const observation = observeMatch(
        {
          ...state,
          round: { ...state.round, pointTarget: target },
        },
        "ai",
      );
      expect(baselinePolicy(observation, actions(state))).toBe(expected);
    },
  );
  it("reads the observation viewer's own hand, without hardcoding an opponent seat", () => {
    const { state } = match([8, 2, 9, 3]);
    const observation = observeMatch(state, "human");
    expect(observation.round.hands.human.total).toBe(5);
    expect(observation.round.hands.ai.total).toBeNull();
    expect(baselinePolicy(observation, ["Hit", "Stay"])).toBe("Hit");
  });
});

describe("hidden information and deal randomness isolation", () => {
  it.each([
    {
      name: "opponent hidden number",
      prefix: [7, 2, 9, 10],
      trump: "test-draw-2",
    },
    {
      name: "draw-pile order",
      prefix: [7, 1, 9, 10, 11, 8, 6, 5, 4, 3, 2],
      trump: "test-draw-2",
    },
    {
      name: "opponent hidden trump identity",
      prefix: [7, 1, 9, 10],
      trump: "test-return",
    },
  ] as const)(
    "cannot change its decision with a different $name",
    ({ prefix, trump }) => {
      const original = match([7, 1, 9, 10]);
      const changed = match(prefix, trump);
      const before = observeMatch(original.state, "ai");
      const after = observeMatch(changed.state, "ai");
      expect(changed.state).not.toEqual(original.state);
      expect(after).toEqual(before);
      expect(actions(changed.state)).toEqual(actions(original.state));
      expect(before.round.hands.human.cards[0].value).toBeNull();
      expect(before.round.trumps).not.toHaveProperty("hands");
      const observations = JSON.stringify([before, after]);
      const ambientRandom = vi.spyOn(Math, "random").mockImplementation(() => {
        throw new Error("Strategy used ambient randomness");
      });
      try {
        for (let i = 0; i < 20; i++) {
          expect(baselinePolicy(before, actions(original.state))).toBe("Hit");
          expect(baselinePolicy(after, actions(changed.state))).toBe("Hit");
        }
      } finally {
        ambientRandom.mockRestore();
      }
      expect(JSON.stringify([before, after])).toBe(observations);
      expect(original.random).toHaveBeenCalledTimes(11);
      expect(changed.random).toHaveBeenCalledTimes(11);
    },
  );
});
