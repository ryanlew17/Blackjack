import { describe, expect, it } from "vitest";
import {
  freshGame,
  legalActions,
  RULES,
  score,
  shuffle,
  transition,
  type CardId,
  type GameCommand,
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
    const s = transition(dealt([0, 13, 9, 22]), {
      type: "declineInsurance",
    }).state;
    expect(s.outcome).toBe("push");
    expect(s.balance).toBe(200000);
  });
  it("checks dealer blackjack after declining insurance", () => {
    const s = transition(dealt([8, 0, 7, 9]), {
      type: "declineInsurance",
    }).state;
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
    const s = act(
      transition(dealt([9, 0, 7, 5]), { type: "declineInsurance" }).state,
      "stand",
    );
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
      if (s.phase === "insurance")
        s = transition(s, { type: "declineInsurance" }).state;
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
    const rules: RuleSet = { ...RULES, standSoft17: false, insurance: false };
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
// @req REQ-2026-002
describe("soft 17 must-hit variants", () => {
  const rules: RuleSet = { ...RULES, standSoft17: false, insurance: false };
  const settle = (prefix: CardId[], bet = 1000) =>
    transition(dealt(prefix, bet, rules), { type: "stand" }, Math.random, rules)
      .state;
  it("dealer A+6 draws to a hard 16 and busts, player wins", () => {
    const s = settle([9, 0, 7, 5, 8, 9]);
    expect(s.dealer).toHaveLength(4);
    expect(score(s.dealer).total).toBe(26);
    expect(s.outcome).toBe("win");
    expect(s.balance).toBe(201000);
  });
  it("dealer A+6 draws a ten, ace degrades to hard 17 and stands, points settle", () => {
    const s = settle([7, 0, 8, 5, 9]);
    expect(s.dealer).toHaveLength(3);
    expect(score(s.dealer)).toEqual({ total: 17, soft: false });
    expect(s.outcome).toBe("push");
    expect(s.balance).toBe(200000);
  });
  it("dealer A+A+5 is soft 17, draws a ten, degrades to hard 17 and stands", () => {
    const s = settle([9, 0, 7, 13, 4, 9]);
    expect(s.dealer).toHaveLength(4);
    expect(score(s.dealer)).toEqual({ total: 17, soft: false });
    expect(s.outcome).toBe("win");
    expect(s.balance).toBe(201000);
  });
});

const command = (s: GameState, type: GameCommand["type"]) =>
  transition(s, { type } as GameCommand).state;
// @req REQ-2026-004
describe("split hands", () => {
  it("splits equal values including different face ranks, but only once", () => {
    for (const prefix of [
      [7, 9, 20, 6, 1, 2],
      [9, 8, 10, 7, 1, 2],
    ]) {
      const initial = dealt(prefix);
      const s = command(initial, "split");
      expect(s.hands).toHaveLength(2);
      expect(s.balance).toBe(198000);
      expect(s.hands.map((h) => h.cards)).toEqual([
        [prefix[0], prefix[4]],
        [prefix[2], prefix[5]],
      ]);
      expect(s.activeHand).toBe(0);
      expect(command(s, "split")).toBe(s);
      const next = command(s, "stand");
      expect(next.activeHand).toBe(1);
      expect(next.phase).toBe("player");
      expect(command(next, "split")).toBe(next);
    }
    const unequal = dealt([7, 9, 6, 8]);
    expect(command(unequal, "split")).toBe(unequal);
    const broke = dealt([7, 9, 20, 6], 200000);
    expect(command(broke, "split")).toBe(broke);
    const hit = command(dealt([1, 9, 14, 6, 2]), "hit");
    expect(command(hit, "split")).toBe(hit);
  });
  it("split aces draw once each, never pay natural blackjack", () => {
    const s = command(dealt([0, 8, 13, 7, 9, 22]), "split");
    expect(s.phase).toBe("settled");
    expect(s.hands.map((h) => h.cards.length)).toEqual([2, 2]);
    expect(s.hands.map((h) => h.outcome)).toEqual(["win", "win"]);
    expect(s.balance).toBe(202000);
    expect(s.history[0].bet).toBe(2000);
    for (const type of ["hit", "double", "split"] as const)
      expect(command(s, type)).toBe(s);
  });
  it("automatically skips a split 21 and supports doubling the other hand", () => {
    let s = command(dealt([9, 8, 10, 7, 0, 1, 6]), "split");
    expect(s.activeHand).toBe(1);
    s = command(s, "double");
    expect(s.hands.map((h) => h.outcome)).toEqual(["win", "win"]);
    expect(s.hands[1].bet).toBe(2000);
    expect(s.history[0].net).toBe(3000);
    expect(s.balance).toBe(203000);
  });
  it("keeps the other hand live after bust, and aggregates mixed results once", () => {
    let s = command(dealt([7, 9, 20, 6, 8, 22, 10]), "split");
    s = command(s, "hit");
    expect(s.hands[0].status).toBe("busted");
    expect(s.activeHand).toBe(1);
    expect(s.history).toHaveLength(0);
    s = command(s, "stand");
    expect(s.hands.map((h) => h.outcome)).toEqual(["lose", "win"]);
    expect(s.outcome).toBe("mixed");
    expect(s.history).toHaveLength(1);
    expect(s.history[0].net).toBe(0);
    expect(s.balance).toBe(200000);
    expect(command(s, "stand")).toBe(s);
  });
  it("does not draw for the dealer when both hands bust", () => {
    let s = command(dealt([7, 8, 20, 5, 9, 22, 10, 23]), "split");
    s = command(command(s, "hit"), "hit");
    expect(s.dealer).toHaveLength(2);
    expect(s.hands.map((h) => h.outcome)).toEqual(["lose", "lose"]);
    expect(s.balance).toBe(198000);
  });
  it("draws for the dealer only after both hands finish", () => {
    let s = command(dealt([7, 8, 20, 5, 9, 22, 1]), "split");
    const first = transition(s, { type: "stand" });
    expect(first.events).toHaveLength(0);
    s = transition(first.state, { type: "stand" }).state;
    expect(s.dealer).toHaveLength(3);
    expect(s.hands.map((h) => h.outcome)).toEqual(["win", "win"]);
  });
  it("obeys per-call feature switches in actions and transitions", () => {
    const rules = {
      ...RULES,
      split: false,
      surrender: false,
      insurance: false,
    };
    const s = dealt([7, 9, 20, 6], 1000, rules);
    for (const type of ["split", "surrender"] as const) {
      expect(legalActions(s, rules)).not.toContain(type);
      expect(transition(s, { type }, Math.random, rules).state).toBe(s);
    }
    expect(dealt([8, 0, 7, 9], 1000, rules).phase).toBe("settled");
  });
});
// @req REQ-2026-005
describe("insurance", () => {
  for (const playerNatural of [false, true])
    for (const dealerNatural of [false, true])
      for (const buy of [false, true]) {
        it(`settles separately: player natural ${playerNatural}, dealer natural ${dealerNatural}, buy ${buy}`, () => {
          const s = dealt(
            [playerNatural ? 13 : 7, 0, 9, dealerNatural ? 22 : 5],
            100,
          );
          expect(s.phase).toBe("insurance");
          expect(s.outcome).toBeNull();
          expect(s.history).toHaveLength(0);
          const result = transition(s, {
            type: buy ? "insure" : "declineInsurance",
          });
          const next = result.state;
          expect(next.insurance).toEqual({
            bet: buy ? 50 : 0,
            outcome: buy ? (dealerNatural ? "win" : "lose") : "declined",
          });
          const mainNet = playerNatural
            ? dealerNatural
              ? 0
              : 150
            : dealerNatural
              ? -100
              : 0;
          const insuranceNet = buy ? (dealerNatural ? 100 : -50) : 0;
          expect(next.balance).toBe(
            200000 +
              (playerNatural || dealerNatural ? mainNet : -100) +
              insuranceNet,
          );
          if (playerNatural || dealerNatural) {
            expect(next.phase).toBe("settled");
            expect(next.history[0].net).toBe(mainNet + insuranceNet);
            expect(next.history[0].bet).toBe(buy ? 150 : 100);
          } else expect(next.phase).toBe("player");
          expect(command(next, "insure")).toBe(next);
          expect(command(next, "declineInsurance")).toBe(next);
        });
      }
  it("locks all player actions until a decision, and does not reveal naturals early", () => {
    const initial = transition(freshGame(), { type: "bet", amount: 100 }).state;
    const r = transition(
      initial,
      { type: "deal" },
      fixedRandom([13, 0, 9, 22]),
    );
    expect(r.events.map((e) => e.type)).toEqual([
      "card",
      "card",
      "card",
      "card",
    ]);
    for (const type of [
      "hit",
      "stand",
      "double",
      "split",
      "surrender",
      "next",
    ] as const)
      expect(command(r.state, type)).toBe(r.state);
  });
  it("allows exact funds and excludes unaffordable insurance", () => {
    const initial = freshGame();
    initial.balance = 150;
    const bet = transition(initial, { type: "bet", amount: 100 }).state;
    const s = transition(
      bet,
      { type: "deal" },
      fixedRandom([7, 0, 9, 5]),
    ).state;
    expect(command(s, "insure").balance).toBe(0);
    const all = dealt([7, 0, 9, 5], 200000);
    expect(legalActions(all)).toEqual(["declineInsurance"]);
    expect(command(all, "insure")).toBe(all);
    expect(command(all, "declineInsurance").phase).toBe("player");
  });
  it("insurance reduces funds available for splitting and doubling", () => {
    const initial = freshGame();
    initial.balance = 200;
    const bet = transition(initial, { type: "bet", amount: 100 }).state;
    const s = transition(
      bet,
      { type: "deal" },
      fixedRandom([7, 0, 20, 5]),
    ).state;
    const next = command(s, "insure");
    expect(legalActions(next)).not.toContain("split");
    expect(legalActions(next)).not.toContain("double");
  });
});
// @req REQ-2026-006
describe("late surrender", () => {
  it("returns half an odd whole-chip main wager, once, without drawing", () => {
    const s = command(dealt([9, 8, 5, 4], 300), "surrender");
    expect(s.balance).toBe(199850);
    expect(s.outcome).toBe("surrender");
    expect(s.history[0].net).toBe(-150);
    expect(s.dealer).toHaveLength(2);
    expect(command(s, "surrender")).toBe(s);
  });
  it("allows surrender after either insurance choice and preserves losses", () => {
    for (const buy of [false, true]) {
      const s = command(
        command(dealt([7, 0, 9, 5], 100), buy ? "insure" : "declineInsurance"),
        "surrender",
      );
      expect(s.outcome).toBe("surrender");
      expect(s.balance).toBe(buy ? 199900 : 199950);
      expect(s.history[0].net).toBe(buy ? -100 : -50);
    }
  });
  it("rejects surrender after acting, splitting, naturals and while choosing insurance", () => {
    const cases = [
      command(dealt([1, 8, 2, 7, 3]), "hit"),
      command(dealt([1, 8, 2, 7, 3]), "double"),
      command(dealt([7, 9, 20, 6, 1, 2]), "split"),
      dealt([7, 0, 9, 5]),
      command(dealt([7, 0, 9, 22]), "declineInsurance"),
      dealt([0, 8, 9, 7]),
    ];
    for (const s of cases) expect(command(s, "surrender")).toBe(s);
  });
});

// @req REQ-2026-003 @req REQ-2026-004
it("records a split win and push separately and keeps immutable event snapshots", () => {
  const original = dealt([7, 9, 20, 6, 22, 8]);
  const before = structuredClone(original);
  const split = transition(original, { type: "split" });
  expect(original).toEqual(before);
  expect(split.events.map((e) => e.type)).toEqual(["chip", "card", "card"]);
  expect(split.events[0].state.hands.map((h) => h.cards.length)).toEqual([
    1, 1,
  ]);
  expect(split.events[1].state.hands.map((h) => h.cards.length)).toEqual([
    2, 1,
  ]);
  const s = command(command(split.state, "stand"), "stand");
  expect(s.hands.map((h) => h.outcome)).toEqual(["win", "push"]);
  expect(s.history[0].net).toBe(1000);
  expect(s.outcome).toBe("mixed");
  expect(split.events[0].state.hands[0].outcome).toBeNull();
  expect(split.state.phase).toBe("player");
});
