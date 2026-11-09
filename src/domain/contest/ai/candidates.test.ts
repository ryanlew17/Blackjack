// @req REQ-2026-028: real command execution, complete candidates and observation equivalence.
import { describe, expect, it, vi } from "vitest";
import {
  createMatch,
  observeMatch,
  transitionMatch,
  legalTrumpCommands,
  legalSkillCommands,
} from "../engine";
import type { MatchState, RoundRules } from "../engine";
import { fixedRandom } from "../engine/testHelpers";
import {
  numericFixture,
  numericPlay,
  numericFinish,
  emptyNumbers,
} from "../engine/numberEffectTestHelpers";
import { decisionCandidates, type DecisionCommand } from "./candidates";

const candidates = (state: MatchState, viewer = state.round.turn!.player) =>
  decisionCandidates(observeMatch(state, viewer));

function skillMatch(
  human: "metamorphosis" | "mind-grip" | "spirit-sight",
  ai: "twin-bloom" | "spirit-sight",
) {
  const shuffle = fixedRandom([10, 8, 11, 9]);
  let coin = true;
  const random = {
    numbers: vi.fn(() => (coin ? ((coin = false), 0.25) : shuffle())),
    trumpGate: vi.fn(() => 0),
    trumpSelection: vi.fn(() => 0),
    skillSelection: vi.fn(() => 0),
    skillEffects: vi.fn(() => 0),
  };
  const rules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "nightmare",
      playableDifficulties: ["nightmare"],
      selected: { human, ai },
    },
  };
  return { state: createMatch(random, rules).state, random };
}

describe("authorized decision candidates", () => {
  it("has an observation-only input and excludes lifecycle/internal commands", () => {
    const acceptsState: MatchState extends Parameters<
      typeof decisionCandidates
    >[0]
      ? true
      : false = false;
    const next: "NextRound" extends DecisionCommand["type"] ? true : false =
      false;
    const forced: "ResolveForcedTurn" extends DecisionCommand["type"]
      ? true
      : false = false;
    expect([acceptsState, next, forced]).toEqual([false, false, false]);
  });

  it("enumerates every target and payment using engine legality, with immutable scoped commands", () => {
    const state = numericFixture(["mixed", "fee", "face-lighten", "draw-2"]);
    const view = observeMatch(state, "human");
    const result = decisionCandidates(view);
    const trumps = result.filter((c) => c.type === "PlayTrump");
    expect(trumps).toEqual(
      legalTrumpCommands(view.round).map((c) => ({
        ...c,
        roundNumber: state.roundNumber,
      })),
    );
    expect(trumps.some((c) => c.costIds?.length)).toBe(true);
    expect(trumps.some((c) => c.targetId)).toBe(true);
    expect(result.slice(0, 2).map((c) => c.type)).toEqual(["Hit", "Stay"]);
    expect(Object.isFrozen(result)).toBe(true);
    for (const command of result) {
      expect(Object.isFrozen(command)).toBe(true);
      if (command.type === "PlayTrump" && command.costIds)
        expect(Object.isFrozen(command.costIds)).toBe(true);
      expect(transitionMatch(state, command, () => 0).state).not.toBe(state);
    }
    expect(candidates(state, "ai")).toEqual([]);
  });

  it("keeps legal unsuccessful draws instead of probing the unknown deck", () => {
    const found = numericFixture(["draw-2"], [], [10, 8, 11, 9]);
    const missing = numericFixture(["draw-2"], [], [10, 2, 11, 9]);
    expect(observeMatch(found, "human")).toEqual(
      observeMatch(missing, "human"),
    );
    expect(candidates(found)).toEqual(candidates(missing));
    const command = candidates(found).find((c) => c.type === "PlayTrump")!;
    expect(
      transitionMatch(found, command, () => 0).state.round.hands.human,
    ).toHaveLength(3);
    expect(
      transitionMatch(missing, command, () => 0).state.round.hands.human,
    ).toHaveLength(2);
  });

  it("does not expose hidden hand identities or deck order through enumeration", () => {
    const original = numericFixture(["draw-2"], ["return"]);
    for (const changed of [
      numericFixture(["draw-2"], ["draw-3"]),
      numericFixture(["draw-2"], ["return"], [10, 8, 11, 9, 7, 6]),
    ]) {
      expect(changed).not.toEqual(original);
      expect(observeMatch(changed, "human")).toEqual(
        observeMatch(original, "human"),
      );
      expect(candidates(changed)).toEqual(candidates(original));
    }
  });

  it("re-enumerates after card consumption without ending the Turn or imposing a card cap", () => {
    const before = numericFixture(["draw-2", "return"]);
    const after = numericPlay(before, "draw-2").state;
    expect(after.round.turn?.player).toBe(before.round.turn?.player);
    expect(
      candidates(after)
        .filter((c) => c.type === "PlayTrump")
        .map((c) => c.instanceId),
    ).toEqual(["human-1"]);
    expect(candidates(after).map((c) => c.type)).toContain("Stay");
  });

  it("returns Stay for an empty deck and no decision after settlement", () => {
    expect(
      candidates(emptyNumbers(numericFixture([]))).map((c) => c.type),
    ).toEqual(["Stay"]);
    expect(
      decisionCandidates(
        observeMatch(numericFinish(numericFixture([])), "human"),
      ),
    ).toEqual([]);
  });

  it("includes ordinary skills without consuming any real or ambient randomness", () => {
    const { state, random } = skillMatch("spirit-sight", "spirit-sight");
    const view = observeMatch(state, "human");
    const snapshot = JSON.stringify(view);
    const counts = Object.values(random).map((fn) => fn.mock.calls.length);
    const ambient = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("ambient RNG");
    });
    try {
      const expected = legalSkillCommands(view.round).map((c) => ({
        ...c,
        roundNumber: state.roundNumber,
      }));
      expect(expected).toHaveLength(1);
      for (let i = 0; i < 20; i++)
        expect(
          decisionCandidates(view).filter((c) => c.type === "ActivateSkill"),
        ).toEqual(expected);
    } finally {
      ambient.mockRestore();
    }
    expect(Object.values(random).map((fn) => fn.mock.calls.length)).toEqual(
      counts,
    );
    expect(JSON.stringify(view)).toBe(snapshot);
  });

  it("gates a reaction to activate/pass with exact boundary tokens, then resumes ordinary decisions", () => {
    const { state, random } = skillMatch("spirit-sight", "twin-bloom");
    const choices = candidates(state, "ai");
    expect(choices.map((c) => c.type)).toEqual([
      "ActivateSkill",
      "PassReaction",
    ]);
    expect(candidates(state, "human")).toEqual([]);
    for (const command of choices)
      expect(transitionMatch(state, command, random).state).not.toBe(state);
    const pass = choices.find((c) => c.type === "PassReaction")!;
    const after = transitionMatch(state, pass, random).state;
    expect(candidates(after).map((c) => c.type)).toContain("Stay");
    expect(transitionMatch(after, pass, random).state).toBe(after);
  });

  it("cannot distinguish secret preparation or actual opponent remaining uses", () => {
    const { state, random } = skillMatch("metamorphosis", "spirit-sight");
    const activation = candidates(state).find(
      (c) => c.type === "ActivateSkill",
    )!;
    const prepared = transitionMatch(state, activation, random).state;
    const stay = {
      type: "Stay" as const,
      player: "human" as const,
      roundNumber: state.roundNumber,
    };
    const plain = transitionMatch(state, stay, random).state;
    const secret = transitionMatch(prepared, stay, random).state;
    expect(secret.round.skills).not.toEqual(plain.round.skills);
    expect(observeMatch(secret, "ai")).toEqual(observeMatch(plain, "ai"));
    expect(candidates(secret)).toEqual(candidates(plain));
  });

  it("leaves a forced Turn to the coordinator instead of offering extra Hit decisions", () => {
    const { state, random } = skillMatch("mind-grip", "spirit-sight");
    const activated = transitionMatch(
      state,
      candidates(state).find((c) => c.type === "ActivateSkill")!,
      random,
    ).state;
    const next = transitionMatch(
      activated,
      { type: "Stay", player: "human", roundNumber: state.roundNumber },
      random,
    ).state;
    expect(next.round.turn?.controlledBy).toBe("human");
    expect(candidates(next)).toEqual([]);
  });
});
