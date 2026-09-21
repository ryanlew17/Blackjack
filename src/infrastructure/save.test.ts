import { afterEach, describe, expect, it, vi } from "vitest";
import { freshGame, transition } from "../domain/game";
import { dealt } from "../domain/testHelpers";
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
        JSON.stringify({ ...envelope(freshGame(), settings), version: 2 }),
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
