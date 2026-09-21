import { freshGame, score, type GameState, type Outcome } from "../domain/game";
export type Language = "en" | "zh";
export interface Settings {
  language: Language;
  muted: boolean;
  volume: number;
  motion: "system" | "reduce" | "full";
}
export interface SaveEnvelope {
  version: 1;
  rulesVersion: 1;
  savedAt: string;
  revision: string;
  game: GameState;
  settings: Settings;
}
export const STORAGE_KEY = "green-room.blackjack.v1";
export const MAX_SAVE_SIZE = 128 * 1024;
export const defaultSettings = (): Settings => ({
  language: navigator.language.startsWith("zh") ? "zh" : "en",
  muted: false,
  volume: 0.3,
  motion: "system",
});
export const envelope = (
  game: GameState,
  settings: Settings,
): SaveEnvelope => ({
  version: 1,
  rulesVersion: 1,
  savedAt: new Date().toISOString(),
  revision: crypto.randomUUID(),
  game,
  settings,
});
export class SaveError extends Error {
  constructor(public code: "invalid" | "version" | "size") {
    super(code);
  }
}
const validMoney = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v % 50 === 0;
const validBet = (v: unknown): v is number =>
  validMoney(v) && v > 0 && v % 100 === 0;
const outcomes: Outcome[] = ["blackjack", "win", "lose", "push"];
export function parseSave(raw: string): SaveEnvelope {
  if (new TextEncoder().encode(raw).length > MAX_SAVE_SIZE)
    throw new SaveError("size");
  let v: SaveEnvelope;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new SaveError("invalid");
  }
  if (!v || typeof v !== "object") throw new SaveError("invalid");
  if (v.version !== 1 || v.rulesVersion !== 1) throw new SaveError("version");
  try {
    const g = v.game,
      p = v.settings;
    if (
      typeof v.revision !== "string" ||
      !v.revision ||
      typeof v.savedAt !== "string" ||
      !Number.isFinite(Date.parse(v.savedAt))
    )
      throw 0;
    if (
      !p ||
      !["en", "zh"].includes(p.language) ||
      typeof p.muted !== "boolean" ||
      !Number.isFinite(p.volume) ||
      p.volume < 0 ||
      p.volume > 1 ||
      !["system", "reduce", "full"].includes(p.motion)
    )
      throw 0;
    if (
      !g ||
      !["betting", "player", "settled"].includes(g.phase) ||
      !validMoney(g.balance) ||
      !Number.isSafeInteger(g.round) ||
      g.round < 0 ||
      !Array.isArray(g.hands) ||
      g.hands.length !== 1
    )
      throw 0;
    const h = g.hands[0];
    if (
      !h ||
      !validMoney(h.bet) ||
      h.bet % 100 ||
      typeof h.doubled !== "boolean"
    )
      throw 0;
    if (
      ![h.cards, g.dealer, g.deck, g.bets, g.history].every(Array.isArray) ||
      g.bets.length > 1000 ||
      g.history.length > 30
    )
      throw 0;
    const cards = [...h.cards, ...g.dealer, ...g.deck];
    if (
      cards.some((c) => !Number.isInteger(c) || c < 0 || c > 51) ||
      new Set(cards).size !== cards.length
    )
      throw 0;
    if (g.bets.some((b) => !validBet(b))) throw 0;
    if (g.phase === "betting") {
      if (
        cards.length ||
        h.doubled ||
        g.outcome !== null ||
        g.bets.reduce((a, b) => a + b, 0) !== h.bet
      )
        throw 0;
    } else {
      if (
        cards.length !== 52 ||
        h.cards.length < 2 ||
        g.dealer.length < 2 ||
        !validBet(h.bet) ||
        g.round < 1 ||
        g.bets.length
      )
        throw 0;
      const player = score(h.cards).total,
        dealer = score(g.dealer).total;
      if (h.doubled && (h.cards.length !== 3 || h.bet % 200)) throw 0;
      if (
        g.phase === "player" &&
        (g.outcome !== null ||
          h.doubled ||
          player >= 21 ||
          g.dealer.length !== 2 ||
          dealer === 21)
      )
        throw 0;
      if (g.phase === "settled") {
        const naturalP = h.cards.length === 2 && player === 21,
          naturalD = g.dealer.length === 2 && dealer === 21;
        const expected: Outcome =
          naturalP && naturalD
            ? "push"
            : naturalD
              ? "lose"
              : naturalP
                ? "blackjack"
                : player > 21
                  ? "lose"
                  : dealer > 21 || player > dealer
                    ? "win"
                    : player === dealer
                      ? "push"
                      : "lose";
        if (
          g.outcome !== expected ||
          (!naturalP && !naturalD && player <= 21 && dealer < 17)
        )
          throw 0;
        if (
          !g.history[0] ||
          g.history[0].round !== g.round ||
          g.history[0].outcome !== g.outcome ||
          g.history[0].bet !== h.bet
        )
          throw 0;
      }
    }
    for (let i = 0; i < g.history.length; i++) {
      const r = g.history[i];
      if (
        !r ||
        !Number.isSafeInteger(r.round) ||
        r.round < 1 ||
        r.round > g.round ||
        (i > 0 && r.round !== g.history[i - 1].round - 1) ||
        !outcomes.includes(r.outcome) ||
        !validBet(r.bet) ||
        r.net !==
          (r.outcome === "blackjack"
            ? r.bet * 1.5
            : r.outcome === "win"
              ? r.bet
              : r.outcome === "push"
                ? 0
                : -r.bet)
      )
        throw 0;
    }
    return {
      version: 1,
      rulesVersion: 1,
      savedAt: v.savedAt,
      revision: v.revision,
      game: g,
      settings: p,
    };
  } catch {
    throw new SaveError("invalid");
  }
}
export function readSave(): {
  save: SaveEnvelope;
  error: "corrupt" | "storage" | null;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      save: raw ? parseSave(raw) : envelope(freshGame(), defaultSettings()),
      error: null,
    };
  } catch (e) {
    return {
      save: envelope(freshGame(), defaultSettings()),
      error: e instanceof SaveError ? "corrupt" : "storage",
    };
  }
}
export function writeSave(save: SaveEnvelope): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
