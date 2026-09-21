import { describe, expect, it } from "vitest";
import {
  freshGame,
  legalActions,
  RULES,
  score,
  shuffle,
  transition,
  type CardId,
  type GameState,
  type RuleSet,
} from "./game";
import { fixedRandom, dealt } from "./testHelpers";
function act(s: GameState, type: "hit" | "stand" | "double") {
  return transition(s, { type }).state;
}
describe("classic rules", () => {
  it("values multiple aces and soft/hard hands", () => {
    expect(score([0, 13, 8])).toEqual({ total: 21, soft: true });
    expect(score([0, 13, 8, 22])).toEqual({ total: 21, soft: false });
  });
  it("shuffles exactly 52 unique cards", () => {
    expect(new Set(shuffle()).size).toBe(52);
    expect(shuffle(() => 0.999)).toEqual(
      Array.from({ length: 52 }, (_, i) => i),
    );
  });
  it("returns a total 2.5x for natural blackjack", () => {
    const s = dealt([0, 8, 9, 7], 100);
    expect(s.outcome).toBe("blackjack");
    expect(s.balance).toBe(200150);
    expect(s.history[0].net).toBe(150);
  });
  it("pushes double naturals", () => {
    const s = dealt([0, 13, 9, 22]);
    expect(s.outcome).toBe("push");
    expect(s.balance).toBe(200000);
  });
  it("checks dealer blackjack immediately", () => {
    const s = dealt([8, 0, 7, 9]);
    expect(s.outcome).toBe("lose");
    expect(s.phase).toBe("settled");
  });
  it("ordinary 21 waits for dealer and can push", () => {
    const s = act(dealt([9, 8, 4, 6, 5, 17]), "hit");
    expect(s.hands[0].cards.length).toBe(3);
    expect(s.dealer.length).toBe(3);
    expect(s.outcome).toBe("push");
  });
  it("dealer stands on soft 17", () => {
    const s = act(dealt([9, 0, 7, 5]), "stand");
    expect(s.dealer.length).toBe(2);
    expect(s.outcome).toBe("win");
  });
  it("dealer draws under 17 and can bust", () => {
    const s = act(dealt([9, 8, 7, 6, 22]), "stand");
    expect(s.dealer.length).toBe(3);
    expect(s.outcome).toBe("win");
  });
  it("player bust loses without dealer drawing", () => {
    const s = act(dealt([9, 8, 7, 5, 22]), "hit");
    expect(s.outcome).toBe("lose");
    expect(s.dealer.length).toBe(2);
  });
  it("double deducts one extra wager and draws exactly one card", () => {
    const s = act(dealt([4, 9, 5, 6, 8]), "double");
    expect(s.hands[0].cards.length).toBe(3);
    expect(s.hands[0].bet).toBe(2000);
    expect(s.outcome).toBe("win");
    expect(s.balance).toBe(202000);
  });
  it("double can bust", () => {
    expect(act(dealt([9, 8, 7, 5, 22]), "double").outcome).toBe("lose");
  });
  it("disallows double after hit or with insufficient balance", () => {
    const s = dealt([1, 8, 2, 7, 3]);
    expect(legalActions(act(s, "hit"))).not.toContain("double");
    const all = dealt([1, 8, 2, 7], 200000);
    expect(transition(all, { type: "double" }).state).toBe(all);
  });
  it("ties return the original bet", () => {
    const s = act(dealt([9, 22, 7, 20]), "stand");
    expect(s.outcome).toBe("push");
    expect(s.balance).toBe(200000);
  });
  it("settles only once despite repeated commands", () => {
    const s = act(dealt([9, 8, 7, 5, 22]), "hit");
    for (const type of ["hit", "stand", "double", "deal"] as const)
      expect(transition(s, { type })).toEqual({ state: s, events: [] });
    expect(s.history.length).toBe(1);
  });
  it("rejects zero, fractions, negative, unsafe and unaffordable bets", () => {
    const s = freshGame();
    for (const amount of [
      0,
      -100,
      50,
      100.5,
      200100,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER,
    ])
      expect(transition(s, { type: "bet", amount }).state).toBe(s);
  });
  it("undo and clear return escrowed funds", () => {
    let s = transition(freshGame(), { type: "bet", amount: 100 }).state;
    s = transition(s, { type: "bet", amount: 1000 }).state;
    s = transition(s, { type: "undo" }).state;
    expect(s.balance).toBe(199900);
    s = transition(s, { type: "clear" }).state;
    expect(s.balance).toBe(200000);
    expect(s.hands[0].bet).toBe(0);
  });
  it("all in preserves half chips and includes current wager", () => {
    let s = freshGame();
    s.balance = 200050;
    s = transition(s, { type: "bet", amount: 1000 }).state;
    s = transition(s, { type: "allIn" }).state;
    expect(s.balance).toBe(50);
    expect(s.hands[0].bet).toBe(200000);
  });
  it("does not mutate inputs and emits ordered presentation snapshots", () => {
    const initial = transition(freshGame(), { type: "bet", amount: 100 }).state;
    const before = structuredClone(initial);
    const result = transition(
      initial,
      { type: "deal" },
      fixedRandom([0, 8, 9, 7]),
    );
    expect(initial).toEqual(before);
    expect(result.events.map((e) => e.type)).toEqual([
      "card",
      "card",
      "card",
      "card",
      "reveal",
      "result",
    ]);
    expect(result.events[0].state.hands[0].cards).toHaveLength(1);
  });
  it("next hand clears cards but retains history and balance", () => {
    const s = dealt([0, 8, 9, 7]);
    const next = transition(s, { type: "next" }).state;
    expect(next.phase).toBe("betting");
    expect(next.deck).toHaveLength(0);
    expect(next.balance).toBe(s.balance);
    expect(next.history).toEqual(s.history);
  });
  it("random rounds conserve cards and return to a legal terminal state", () => {
    for (let i = 0; i < 300; i++) {
      let s = transition(freshGame(), { type: "bet", amount: 1000 }).state;
      s = transition(s, { type: "deal" }).state;
      while (s.phase === "player")
        s = act(s, score(s.hands[0].cards).total < 15 ? "hit" : "stand");
      expect(s.phase).toBe("settled");
      expect(new Set([...s.deck, ...s.dealer, ...s.hands[0].cards]).size).toBe(
        52,
      );
      expect(Number.isInteger(s.balance)).toBe(true);
    }
  });
  it("pays 6:5 when the rules say so", () => {
    const rules: RuleSet = { ...RULES, blackjackPayout: [6, 5] };
    const s = dealt([0, 8, 9, 7], 100, rules);
    expect(s.outcome).toBe("blackjack");
    expect(s.history[0].net).toBe(120);
    expect(s.balance).toBe(200120);
  });
  it("hits soft 17 when the rules say so", () => {
    const rules: RuleSet = { ...RULES, standSoft17: false };
    const s = transition(
      dealt([9, 0, 7, 5, 13], 1000, rules),
      { type: "stand" },
      Math.random,
      rules,
    ).state;
    expect(s.dealer.length).toBe(3);
    expect(score(s.dealer).total).toBe(18);
    expect(s.outcome).toBe("push");
  });
});
