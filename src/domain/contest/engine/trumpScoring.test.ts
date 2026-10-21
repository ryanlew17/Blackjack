// @req REQ-2026-024: score direction, clamp order and single Game/Match award.
import { describe, it, expect, vi } from "vitest";
import { freezeData } from "../immutable";
import {
  transitionMatch,
  projectMatchTransition,
  SKILL_USE_RECOVERY,
  observeMatch,
} from "./index";
import {
  fixture,
  prepare,
  play,
  act,
  finish,
  ledger,
  table,
  DEFINITIONS,
} from "./interactionTestHelpers";
const streams = () => ({
  numbers: vi.fn(() => {
    throw new Error("Unexpected number RNG");
  }),
  trumpGate: vi.fn(() => 0),
  trumpSelection: vi.fn(() => 0),
});
const cases: {
  name: string;
  human: string[];
  ai: string[];
  attack: number;
  defense: number;
  increment: number;
}[] = [
  { name: "base", human: [], ai: [], attack: 0, defense: 0, increment: 1 },
  {
    name: "attack",
    human: ["pressure"],
    ai: [],
    attack: 1,
    defense: 0,
    increment: 2,
  },
  {
    name: "defense preserves base",
    human: [],
    ai: ["shield", "shield"],
    attack: 0,
    defense: 2,
    increment: 1,
  },
  {
    name: "winner direction only",
    human: ["pressure"],
    ai: ["pressure", "pressure"],
    attack: 1,
    defense: 0,
    increment: 2,
  },
  {
    name: "clamp at two bonus",
    human: ["pressure", "pressure", "pressure"],
    ai: [],
    attack: 3,
    defense: 0,
    increment: 3,
  },
  {
    name: "cancel before clamp",
    human: Array(5).fill("pressure"),
    ai: Array(4).fill("shield"),
    attack: 5,
    defense: 4,
    increment: 2,
  },
  {
    name: "cancel exactly",
    human: ["pressure"],
    ai: ["shield"],
    attack: 1,
    defense: 1,
    increment: 1,
  },
  {
    name: "excess defense",
    human: ["pressure"],
    ai: ["shield", "shield"],
    attack: 1,
    defense: 2,
    increment: 1,
  },
  {
    name: "winner pledge",
    human: ["risk-pledge"],
    ai: [],
    attack: 2,
    defense: 0,
    increment: 3,
  },
  {
    name: "loser pledge",
    human: [],
    ai: ["risk-pledge"],
    attack: 1,
    defense: 0,
    increment: 2,
  },
  {
    name: "both pledges",
    human: ["risk-pledge"],
    ai: ["risk-pledge", "shield"],
    attack: 3,
    defense: 1,
    increment: 3,
  },
  {
    name: "ceasefire",
    human: ["pressure", "risk-pledge"],
    ai: ["ceasefire"],
    attack: 3,
    defense: 0,
    increment: 1,
  },
  {
    name: "full guard",
    human: ["pressure"],
    ai: ["full-shield"],
    attack: 1,
    defense: 0,
    increment: 0,
  },
  {
    name: "ceasefire and guard",
    human: ["ceasefire"],
    ai: ["full-shield"],
    attack: 0,
    defense: 0,
    increment: 0,
  },
  {
    name: "winner guard has no attack",
    human: ["full-shield"],
    ai: [],
    attack: 0,
    defense: 0,
    increment: 1,
  },
  {
    name: "safe last stand is inactive",
    human: ["last-stand"],
    ai: [],
    attack: 0,
    defense: 0,
    increment: 1,
  },
];
describe("scoring interactions", () => {
  it.each(cases)("$name", ({ human, ai, attack, defense, increment }) => {
    const state = prepare(human, ai),
      result = finish(state);
    ledger(result);
    const event = result.events.find((e) => e.type === "round-scored")!;
    expect(event).toMatchObject({
      winner: "human",
      score: { base: 1, attack, defense, increment },
    });
    expect(event.state.round.trumps!.table.length).toBe(
      human.length + ai.length,
    );
    expect(result.state.game.points).toEqual({ human: increment, ai: 0 });
    expect(result.state.round.trumps!.table).toEqual([]);
    expect(
      projectMatchTransition(result, "ai").events.find(
        (e) => e.type === "round-scored",
      ),
    ).toMatchObject({ score: { attack, defense, increment } });
  });
  it.each([false, true])(
    "ties never score, including double bust %s",
    (busted) => {
      // Unique initial cards: equal 18 totals, over 17 in the second case.
      let state = fixture(
        ["pressure", "last-stand", ...(busted ? ["target-17"] : [])],
        ["shield"],
        [10, 11, 8, 7],
      );
      for (const id of [
        "pressure",
        "last-stand",
        ...(busted ? ["target-17"] : []),
      ])
        state = play(state, id).state;
      const result = finish(state);
      expect(result.state.round.result!.winner).toBeNull();
      expect(result.state.game.points).toEqual({ human: 0, ai: 0 });
      expect(
        result.events.find((e) => e.type === "round-scored"),
      ).toMatchObject({ score: { base: 0, increment: 0 } });
    },
  );
  it("last stand uses both final busted totals and the same comparison result", () => {
    const result = finish(
      prepare(["last-stand", "target-17"], ["shield"], [10, 11, 8, 9]),
    );
    expect(result.state.round.result).toMatchObject({
      winner: "human",
      totals: { human: 18, ai: 20 },
      pointTarget: 17,
    });
    expect(result.state.game.points.human).toBe(2);
  });
  it.each([
    {
      points: { human: 3, ai: 4 },
      target: 5,
      cards: ["pressure"],
      result: 5,
      nextTarget: 5,
      phase: "game-complete",
    },
    {
      points: { human: 3, ai: 4 },
      target: 5,
      cards: [],
      result: 4,
      nextTarget: 7,
      phase: "round-complete",
    },
    {
      points: { human: 6, ai: 6 },
      target: 9,
      cards: ["risk-pledge"],
      result: 9,
      nextTarget: 9,
      phase: "complete",
    },
  ])("commits the full increment once at $points/$target", (test) => {
    let state = fixture(test.cards);
    state = freezeData({
      ...state,
      game: { ...state.game, points: test.points, target: test.target },
      wins: { human: test.phase === "complete" ? 2 : 0, ai: 0 },
    });
    for (const id of test.cards) state = play(state, id).state;
    const result = finish(state);
    expect(result.state.phase).toBe(test.phase);
    expect(result.state.game.points.human).toBe(test.result);
    expect(result.state.game.target).toBe(test.nextTarget);
    expect(result.events.filter((e) => e.type === "round-scored")).toHaveLength(
      1,
    );
    expect(result.events.filter((e) => e.type === "game-won")).toHaveLength(
      test.phase === "round-complete" ? 0 : 1,
    );
    expect(result.events.filter((e) => e.type === "match-won")).toHaveLength(
      test.phase === "complete" ? 1 : 0,
    );
    expect(
      transitionMatch(
        result.state,
        { type: "Stay", player: "human", roundNumber: 1 },
        streams(),
      ).state,
    ).toBe(result.state);
  });
  it("removing Prepared Pressure preserves its resource grant", () => {
    let state = fixture(["pressure-supply"], ["destroy"]);
    state = play(state, "pressure-supply").state;
    expect(state.round.trumps!.hands.human).toHaveLength(1);
    state = act(state, "Stay").state;
    state = play(state, "destroy").state;
    expect(table(state, "pressure-supply")).toEqual([]);
    expect(state.round.trumps!.hands.human).toHaveLength(1);
    expect(finish(state).state.game.points.human).toBe(1);
  });
  it("Sudden Death waits for quiet settlement, bypasses zero-point guard, and awards only one game", () => {
    let state = fixture(["sudden-death", "sudden-death"], ["full-shield"]);
    state = play(state, "sudden-death").state;
    expect(state.phase).toBe("playing");
    expect(state.game.suddenDeath).toBeDefined();
    expect(play(state, "sudden-death").state).toBe(state);
    state = act(state, "Stay").state;
    state = play(state, "full-shield").state;
    const result = finish(state);
    ledger(result);
    expect(result.state.game.points).toEqual({ human: 0, ai: 0 });
    expect(result.state.game.winner).toBe("human");
    expect(result.state.wins.human).toBe(1);
    expect(result.state.winner).toBeNull();
    expect(result.state.game.suddenDeath).toBeUndefined();
    expect(result.state.round.suddenDeath).toBeUndefined();
    expect(result.events.filter((e) => e.type === "game-won")).toHaveLength(1);
  });
  it("Sudden Death survives a tie into the next round and can decide the final Match game", () => {
    let state = play(
      fixture(["sudden-death"], [], [10, 9, 5, 6]),
      "sudden-death",
    ).state;
    state = freezeData({ ...state, wins: { human: 2, ai: 0 } });
    state = finish(state).state;
    expect(state.phase).toBe("round-complete");
    expect(state.game.suddenDeath).toBeDefined();
    const shuffle = fixedRandom([8, 10, 9, 11]);
    state = transitionMatch(
      state,
      { type: "NextRound", roundNumber: 1 },
      { ...streams(), numbers: shuffle },
    ).state;
    const result = finish(state);
    expect(result.state.winner).toBe("human");
    expect(result.events.filter((e) => e.type === "game-won")).toHaveLength(1);
    expect(result.events.filter((e) => e.type === "match-won")).toHaveLength(1);
  });
  it("Regret reverses and re-reverses the Game marker without returning either played card", () => {
    let state = fixture(["sudden-death", "regret", "regret"]);
    state = play(state, "sudden-death").state;
    state = play(state, "regret").state;
    expect(state.game.suddenDeath).toBeUndefined();
    const result = play(state, "regret");
    ledger(result);
    expect(result.state.game.suddenDeath).toBeDefined();
    expect(result.state.round.trumps!.destroyed).toHaveLength(3);
  });
  it("keeps skill recovery as an explicit value contract until a skill is implemented", () => {
    expect(SKILL_USE_RECOVERY).toEqual({
      uses: 1,
      additionalGameActivations: 1,
    });
    expect(Object.isFrozen(SKILL_USE_RECOVERY)).toBe(true);
    expect(Object.keys(DEFINITIONS)).toHaveLength(53);
    expect(DEFINITIONS).not.toHaveProperty("skill-revival");
  });
});
import { fixedRandom } from "./testHelpers";

describe("scoring controls and transfers", () => {
  it("Suppress marks Full Guard inactive, then its exact Turn expiry resumes the guard before settlement", () => {
    let state = fixture(
      ["full-shield"],
      ["suppress", "pressure"],
      [8, 10, 9, 11],
    );
    state = play(state, "full-shield").state;
    state = act(state, "Stay").state;
    state = play(state, "suppress").state;
    state = play(state, "pressure").state;
    expect(
      observeMatch(state, "human").round.trumps!.table.find(
        (t) => t.kind === "full-shield",
      )!.suppressed,
    ).toBe(true);
    state = act(state, "Stay").state;
    state = act(state, "Stay").state;
    expect(table(state, "suppress")).toEqual([]);
    expect(
      observeMatch(state, "human").round.trumps!.table.find(
        (t) => t.kind === "full-shield",
      )!.suppressed,
    ).not.toBe(true);
    const result = finish(state);
    ledger(result);
    expect(result.events.find((e) => e.type === "round-scored")).toMatchObject({
      winner: "ai",
      score: { attack: 1, guarded: true, increment: 0 },
    });
  });
  it("Table Exchange uses current control for pressure and guard without replaying installation", () => {
    let state = fixture(["pressure", "table-exchange"], ["full-shield"]);
    state = play(state, "pressure").state;
    state = act(state, "Stay").state;
    state = play(state, "full-shield").state;
    state = act(state, "Stay").state;
    state = play(state, "table-exchange").state;
    const result = finish(state);
    ledger(result);
    expect(result.state.game.points.human).toBe(1);
    // Pressure moved to the loser and Full Guard to the winner, so neither adds or blocks the base point.
    expect(result.events.find((e) => e.type === "round-scored")).toMatchObject({
      score: { attack: 0, guarded: false, increment: 1 },
    });
  });
});

// @req REQ-2026-024: a decisive Sudden Death round must not extend an already-won Game.
describe("Sudden Death at the deuce boundary", () => {
  it.each(
    (["human", "ai"] as const).flatMap((winner) =>
      [false, true].map((finalGame) => ({ winner, finalGame })),
    ),
  )(
    "$winner wins at 4:4 without target extension, final Game $finalGame",
    ({ winner, finalGame }) => {
      let state = fixture(
        ["sudden-death"],
        [],
        winner === "human" ? [10, 8, 11, 9] : [8, 10, 9, 11],
      );
      state = freezeData({
        ...state,
        game: {
          ...state.game,
          points:
            winner === "human" ? { human: 3, ai: 4 } : { human: 4, ai: 3 },
        },
        wins: {
          human: winner === "human" && finalGame ? 2 : 0,
          ai: winner === "ai" && finalGame ? 2 : 0,
        },
      });
      state = play(state, "sudden-death").state;
      const result = finish(state);
      ledger(result);
      expect(result.state.game).toMatchObject({
        points: { human: 4, ai: 4 },
        target: 5,
        winner,
      });
      expect(result.state.phase).toBe(finalGame ? "complete" : "game-complete");
      expect(result.state.winner).toBe(finalGame ? winner : null);
      expect(result.events.filter((e) => e.type === "target-extended")).toEqual(
        [],
      );
      expect(
        result.events.filter((e) => e.type === "round-scored"),
      ).toHaveLength(1);
      expect(result.events.filter((e) => e.type === "game-won")).toHaveLength(
        1,
      );
      expect(result.events.filter((e) => e.type === "match-won")).toHaveLength(
        finalGame ? 1 : 0,
      );
      for (const event of result.events)
        expect(event.state.game.target).toBe(5);
      for (const viewer of ["human", "ai"] as const) {
        const projected = projectMatchTransition(result, viewer);
        expect(projected.events.some((e) => e.type === "target-extended")).toBe(
          false,
        );
        expect(projected.events.every((e) => e.state.game.target === 5)).toBe(
          true,
        );
      }
    },
  );
});
