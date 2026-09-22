import { afterEach, describe, expect, it, vi } from "vitest";
import { freshGame, transition } from "../domain/game";
import { dealt, fixedRandom } from "../domain/testHelpers";
import {
  envelope,
  parseSave,
  readSave,
  writeSave,
  type Settings,
} from "./save";
const settings: Settings = {
  language: "en",
  muted: false,
  volume: 0.3,
  motion: "system",
};
afterEach(() => vi.unstubAllGlobals());
describe("save format", () => {
  it("round trips betting, player and settled states", () => {
    for (const game of [
      freshGame(),
      dealt([1, 8, 2, 7]),
      dealt([0, 8, 9, 7]),
    ]) {
      const save = envelope(game, settings);
      expect(parseSave(JSON.stringify(save))).toEqual(save);
    }
  });
  it("round trips an active wager and a doubled hand", () => {
    for (const game of [
      transition(freshGame(), { type: "bet", amount: 1000 }).state,
      transition(dealt([4, 9, 5, 6, 8]), { type: "double" }).state,
    ])
      expect(parseSave(JSON.stringify(envelope(game, settings))).game).toEqual(
        game,
      );
  });
  it("rejects malformed, legacy and future saves", () => {
    expect(() => parseSave("{")).toThrow("invalid");
    expect(() => parseSave('{"存档1":5000}')).toThrow("version");
    expect(() =>
      parseSave(
        JSON.stringify({ ...envelope(freshGame(), settings), version: 3 }),
      ),
    ).toThrow("version");
  });
  it("rejects oversized files", () =>
    expect(() => parseSave(" ".repeat(128 * 1024 + 1))).toThrow("size"));
  it("rejects duplicate, missing and out of range cards", () => {
    for (const bad of ["duplicate", "missing", "range"]) {
      const save = envelope(dealt([1, 8, 2, 7]), settings);
      if (bad === "duplicate") save.game.deck[0] = save.game.dealer[0];
      if (bad === "missing") save.game.deck.pop();
      if (bad === "range") save.game.deck[0] = 52;
      expect(() => parseSave(JSON.stringify(save))).toThrow("invalid");
    }
  });
  it("round trips bankrolls beyond the former 1e12 cap", () => {
    const save = envelope(freshGame(), settings);
    save.game.balance = 5e12;
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });
  it("rejects invalid money and stage mismatches", () => {
    for (const mutate of [
      (s: ReturnType<typeof envelope>) => (s.game.balance = -1),
      (s: ReturnType<typeof envelope>) => (s.game.balance = 12.5),
      (s: ReturnType<typeof envelope>) => (s.game.phase = "dealer"),
      (s: ReturnType<typeof envelope>) => (s.game.hands[0].bet = 100),
    ]) {
      const save = envelope(freshGame(), settings);
      mutate(save);
      expect(() => parseSave(JSON.stringify(save))).toThrow("invalid");
    }
  });
  it("rejects fabricated results and history", () => {
    const save = envelope(dealt([0, 8, 9, 7]), settings);
    save.game.outcome = "lose";
    expect(() => parseSave(JSON.stringify(save))).toThrow("invalid");
    save.game.outcome = "blackjack";
    save.game.history[0].net = 999;
    expect(() => parseSave(JSON.stringify(save))).toThrow("invalid");
  });
  it("rejects invalid preferences", () => {
    const save = envelope(freshGame(), settings);
    save.settings = { ...settings, volume: 9 };
    expect(() => parseSave(JSON.stringify(save))).toThrow("invalid");
  });
  it("survives unavailable browser storage", () => {
    vi.stubGlobal("navigator", { language: "en" });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(readSave().error).toBe("storage");
    expect(writeSave(envelope(freshGame(), settings))).toBe(false);
  });
  it("reports corrupt storage without overwriting it", () => {
    const write = vi.fn();
    vi.stubGlobal("navigator", { language: "en" });
    vi.stubGlobal("localStorage", { getItem: () => "{", setItem: write });
    expect(readSave().error).toBe("corrupt");
    expect(write).not.toHaveBeenCalled();
  });
});

// @req REQ-2026-003 @req REQ-2026-004 @req REQ-2026-005 @req REQ-2026-006
import { legalActions, type GameCommand, type GameState } from "../domain/game";
const step = (s: GameState, type: GameCommand["type"]) =>
  transition(s, { type } as GameCommand).state;
const roundTrip = (game: GameState) =>
  expect(parseSave(JSON.stringify(envelope(game, settings))).game).toEqual(
    game,
  );
describe("v2 saves", () => {
  it("round trips insurance choices, split turns, split aces, doubles and surrender", () => {
    let s = dealt([7, 0, 20, 5, 8, 9, 10, 1], 100);
    roundTrip(s);
    s = step(s, "insure");
    roundTrip(s);
    s = step(s, "split");
    roundTrip(s);
    s = step(s, "hit");
    roundTrip(s);
    s = step(s, "double");
    roundTrip(s);
    roundTrip(step(s, "next"));
    roundTrip(step(dealt([0, 8, 13, 7, 9, 22]), "split"));
    roundTrip(step(step(dealt([7, 0, 9, 5], 300), "insure"), "surrender"));
    roundTrip(step(dealt([0, 13, 9, 22]), "insure"));
    roundTrip(
      step(
        step(step(dealt([7, 8, 20, 5, 9, 22, 10, 23]), "split"), "hit"),
        "hit",
      ),
    );
  });
  it("checks every committed decision across 600 seeded rounds and capped history", () => {
    let seed = 7641;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    let s = freshGame();
    for (let round = 0; round < 600; round++) {
      s = transition(s, { type: "bet", amount: 100 }).state;
      s = transition(s, { type: "deal" }, random).state;
      roundTrip(s);
      let steps = 0;
      while (s.phase !== "settled") {
        expect(steps++).toBeLessThan(40);
        const actions = legalActions(s);
        const type = actions[Math.floor(random() * actions.length)];
        s = step(s, type);
        roundTrip(s);
      }
      expect(
        new Set([...s.deck, ...s.dealer, ...s.hands.flatMap((h) => h.cards)])
          .size,
      ).toBe(52);
      s = step(s, "next");
      roundTrip(s);
    }
    expect(s.history).toHaveLength(30);
  });
  it("rejects forged multi-hand state, insurance and sequential history", () => {
    const split = step(dealt([7, 9, 20, 6, 1, 2]), "split");
    const insurance = dealt([7, 0, 20, 5]);
    const settled = step(step(step(split, "stand"), "stand"), "next");
    const variants: [GameState, (g: GameState) => void][] = [
      [
        split,
        (g) => {
          g.activeHand = 1;
        },
      ],
      [
        split,
        (g) => {
          g.hands.push(structuredClone(g.hands[0]));
        },
      ],
      [
        split,
        (g) => {
          g.hands[1].bet += 100;
        },
      ],
      [
        split,
        (g) => {
          g.hands[1].outcome = "win";
        },
      ],
      [
        split,
        (g) => {
          g.hands[0].status = "surrendered";
        },
      ],
      [
        split,
        (g) => {
          g.originalBet += 100;
        },
      ],
      [
        split,
        (g) => {
          g.insurance = { bet: 500, outcome: "lose" };
        },
      ],
      [
        insurance,
        (g) => {
          g.insurance.bet = 500;
        },
      ],
      [
        insurance,
        (g) => {
          g.phase = "player";
        },
      ],
      [
        step(insurance, "insure"),
        (g) => {
          g.insurance.outcome = "win";
        },
      ],
      [
        step(insurance, "insure"),
        (g) => {
          g.insurance.bet = 50;
        },
      ],
      [
        settled,
        (g) => {
          g.history[0].hands[0].net = 123;
        },
      ],
      [
        settled,
        (g) => {
          g.history[0].bet += 100;
        },
      ],
      [
        settled,
        (g) => {
          g.history[0].insurance = { bet: 500, outcome: "pending" };
        },
      ],
      [
        settled,
        (g) => {
          g.history[0].round++;
        },
      ],
      [
        settled,
        (g) => {
          g.history = [];
        },
      ],
    ];
    for (const [original, mutate] of variants) {
      const g = structuredClone(original);
      mutate(g);
      expect(() => parseSave(JSON.stringify(envelope(g, settings)))).toThrow(
        "invalid",
      );
      roundTrip(original);
    }
  });
  it("rejects v1 and unknown versions without overwriting the legacy storage key", () => {
    const write = vi.fn();
    vi.stubGlobal("navigator", { language: "en" });
    for (const version of [1, 3]) {
      const raw = JSON.stringify({
        ...envelope(freshGame(), settings),
        version,
        rulesVersion: version,
      });
      vi.stubGlobal("localStorage", { getItem: () => raw, setItem: write });
      expect(() => parseSave(raw)).toThrow("version");
      expect(readSave().error).toBe("version");
      expect(write).not.toHaveBeenCalled();
    }
  });
  it("keeps extremely large safe bankrolls and rejects only unrepresentable transitions", () => {
    const s = freshGame();
    s.balance = Math.floor(Number.MAX_SAFE_INTEGER / 100) * 100;
    roundTrip(s);
    const initial = transition(s, { type: "bet", amount: 100 }).state;
    roundTrip(initial);
    // A natural win would exceed safe integer money; the command must not corrupt progress.
    const overflow = transition(
      initial,
      { type: "deal" },
      fixedRandom([0, 8, 9, 7]),
    );
    expect(overflow.state).toBe(initial);
    expect(overflow.events).toEqual([]);
  });
});
