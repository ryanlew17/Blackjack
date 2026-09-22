import {
  freshGame,
  score,
  cardValue,
  handOutcome,
  handNet,
  summarizeRound,
  type GameState,
  type Outcome,
  type Insurance,
  type RoundRecord,
} from "../domain/game";
export type Language = "en" | "zh";
export interface Settings {
  language: Language;
  muted: boolean;
  volume: number;
  motion: "system" | "reduce" | "full";
}
export interface SaveEnvelope {
  version: 2;
  rulesVersion: 2;
  savedAt: string;
  revision: string;
  game: GameState;
  settings: Settings;
}
// Keep the key stable to detect and protect legacy automatic saves. @req REQ-2026-003
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
  version: 2,
  rulesVersion: 2,
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
const outcomes: Outcome[] = ["blackjack", "win", "lose", "push", "surrender"];
function validateInsurance(i: Insurance, originalBet: number) {
  if (
    !i ||
    !["not-offered", "pending", "declined", "win", "lose"].includes(
      i.outcome,
    ) ||
    !validMoney(i.bet) ||
    i.bet !== (["win", "lose"].includes(i.outcome) ? originalBet / 2 : 0)
  )
    throw 0;
}
function sameRecord(a: RoundRecord | undefined, b: RoundRecord): boolean {
  return (
    !!a &&
    Number.isSafeInteger(a.bet) &&
    Number.isSafeInteger(a.net) &&
    a.round === b.round &&
    a.originalBet === b.originalBet &&
    a.outcome === b.outcome &&
    a.bet === b.bet &&
    a.net === b.net &&
    a.insurance?.bet === b.insurance.bet &&
    a.insurance?.outcome === b.insurance.outcome &&
    Array.isArray(a.hands) &&
    a.hands.length === b.hands.length &&
    a.hands.every(
      (h, i) =>
        h.bet === b.hands[i].bet &&
        h.outcome === b.hands[i].outcome &&
        h.net === b.hands[i].net &&
        Number.isSafeInteger(h.net),
    )
  );
}
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
  if (v.version !== 2 || v.rulesVersion !== 2) throw new SaveError("version");
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
    // @req REQ-2026-003 Validate only stable, reachable default-rules v2 states.
    if (
      !g ||
      !["betting", "insurance", "player", "settled"].includes(g.phase) ||
      !validMoney(g.balance) ||
      !Number.isSafeInteger(g.round) ||
      g.round < 0 ||
      !Array.isArray(g.hands) ||
      g.hands.length < 1 ||
      g.hands.length > 2 ||
      !Number.isInteger(g.activeHand) ||
      g.activeHand < 0 ||
      g.activeHand >= g.hands.length ||
      ![g.dealer, g.deck, g.bets, g.history].every(Array.isArray) ||
      g.bets.length > 1000 ||
      g.history.length > 30
    )
      throw 0;
    for (const h of g.hands) {
      if (
        !h ||
        !Array.isArray(h.cards) ||
        !validMoney(h.bet) ||
        h.bet % 100 ||
        typeof h.doubled !== "boolean" ||
        !["active", "stood", "busted", "surrendered"].includes(h.status) ||
        !(h.outcome === null || outcomes.includes(h.outcome))
      )
        throw 0;
    }
    const cards = [...g.hands.flatMap((h) => h.cards), ...g.dealer, ...g.deck];
    if (
      cards.some((c) => !Number.isInteger(c) || c < 0 || c > 51) ||
      new Set(cards).size !== cards.length ||
      g.bets.some((b) => !validBet(b))
    )
      throw 0;
    const split = g.hands.length === 2;
    const first = g.hands[0];
    if (g.phase === "betting") {
      if (
        cards.length ||
        split ||
        first.doubled ||
        first.status !== "active" ||
        first.outcome !== null ||
        g.outcome !== null ||
        g.activeHand !== 0 ||
        g.originalBet !== 0 ||
        g.bets.reduce((a, b) => a + b, 0) !== first.bet ||
        !validMoney(g.balance + first.bet) ||
        !g.insurance ||
        g.insurance.bet !== 0 ||
        g.insurance.outcome !== "not-offered"
      )
        throw 0;
    } else {
      if (
        cards.length !== 52 ||
        g.dealer.length < 2 ||
        !validBet(g.originalBet) ||
        g.round < 1 ||
        g.bets.length
      )
        throw 0;
      const naturalD = g.dealer.length === 2 && score(g.dealer).total === 21;
      if (naturalD && (first.cards.length !== 2 || first.doubled)) throw 0;
      const naturalP =
        !split && first.cards.length === 2 && score(first.cards).total === 21;
      validateInsurance(g.insurance, g.originalBet);
      const offered = g.dealer[0] % 13 === 0;
      if (
        (!offered && g.insurance.outcome !== "not-offered") ||
        (offered && g.insurance.outcome === "not-offered") ||
        (g.phase === "insurance") !== (g.insurance.outcome === "pending") ||
        (g.insurance.outcome === "win" && !naturalD) ||
        (g.insurance.outcome === "lose" && naturalD)
      )
        throw 0;
      if (
        split &&
        (cardValue(first.cards[0]) !== cardValue(g.hands[1].cards[0]) ||
          naturalD)
      )
        throw 0;
      for (const [index, h] of g.hands.entries()) {
        const p = score(h.cards).total;
        if (
          h.cards.length < 2 ||
          h.bet !== g.originalBet * (h.doubled ? 2 : 1) ||
          (h.doubled && h.cards.length !== 3) ||
          (h.status === "busted") !== p > 21 ||
          (h.status === "active" &&
            (h.doubled || (p >= 21 && g.phase !== "insurance"))) ||
          (h.status === "surrendered" &&
            (split ||
              h.doubled ||
              h.cards.length !== 2 ||
              p >= 21 ||
              naturalD ||
              g.phase !== "settled")) ||
          (split &&
            h.cards[0] % 13 === 0 &&
            (h.cards.length !== 2 || h.doubled || h.status !== "stood"))
        )
          throw 0;
        for (let n = 2; n < h.cards.length; n++)
          if (score(h.cards.slice(0, n)).total >= 21) throw 0;
        if (g.phase === "settled") {
          if (
            h.status === "active" ||
            h.outcome !== handOutcome(h, g.dealer, split)
          )
            throw 0;
        } else {
          if (
            h.outcome !== null ||
            (index < g.activeHand && h.status === "active") ||
            (index > g.activeHand &&
              (h.cards.length !== 2 ||
                h.doubled ||
                (h.status !== "active" &&
                  !(
                    h.status === "stood" &&
                    (p === 21 || h.cards[0] % 13 === 0)
                  ))))
          )
            throw 0;
        }
      }
      if (
        g.phase === "insurance" &&
        (split ||
          first.cards.length !== 2 ||
          first.status !== "active" ||
          first.doubled ||
          g.activeHand !== 0)
      )
        throw 0;
      if (
        g.phase === "player" &&
        (naturalD ||
          naturalP ||
          g.hands[g.activeHand].status !== "active" ||
          g.hands.findIndex((h) => h.status === "active") !== g.activeHand)
      )
        throw 0;
      if (
        g.phase !== "settled" &&
        (g.outcome !== null || g.dealer.length !== 2)
      )
        throw 0;
      if (g.phase === "settled") {
        if (g.activeHand !== 0) throw 0;
        const needsDealer =
          !naturalD && !naturalP && g.hands.some((h) => h.status === "stood");
        if (
          (!needsDealer && g.dealer.length !== 2) ||
          (needsDealer && score(g.dealer).total < 17)
        )
          throw 0;
        for (let n = 2; n < g.dealer.length; n++)
          if (score(g.dealer.slice(0, n)).total >= 17) throw 0;
        const expected = summarizeRound(
          g.round,
          g.originalBet,
          g.hands.map((h) => ({
            bet: h.bet,
            outcome: h.outcome!,
            net: handNet(h.bet, h.outcome!),
          })),
          g.insurance,
        );
        if (
          g.outcome !== expected.outcome ||
          !sameRecord(g.history[0], expected)
        )
          throw 0;
      }
    }
    const lastRound =
      g.round - (g.phase === "player" || g.phase === "insurance" ? 1 : 0);
    if (g.history.length !== Math.min(lastRound, 30)) throw 0;
    for (const [index, r] of g.history.entries()) {
      if (
        !r ||
        r.round !== lastRound - index ||
        !validBet(r.originalBet) ||
        !Array.isArray(r.hands) ||
        r.hands.length < 1 ||
        r.hands.length > 2
      )
        throw 0;
      validateInsurance(r.insurance, r.originalBet);
      if (["pending"].includes(r.insurance.outcome)) throw 0;
      for (const h of r.hands) {
        if (
          !h ||
          !validBet(h.bet) ||
          !outcomes.includes(h.outcome) ||
          (h.bet !== r.originalBet && h.bet !== r.originalBet * 2) ||
          ((h.outcome === "blackjack" || h.outcome === "surrender") &&
            (r.hands.length !== 1 || h.bet !== r.originalBet)) ||
          h.net !== handNet(h.bet, h.outcome)
        )
          throw 0;
      }
      if (
        r.insurance.outcome === "win" &&
        (r.hands.length !== 1 ||
          r.hands[0].bet !== r.originalBet ||
          !["lose", "push"].includes(r.hands[0].outcome))
      )
        throw 0;
      if (
        !sameRecord(
          r,
          summarizeRound(r.round, r.originalBet, r.hands, r.insurance),
        )
      )
        throw 0;
    }
    return {
      version: 2,
      rulesVersion: 2,
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
  error: "corrupt" | "storage" | "version" | null;
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
      error:
        e instanceof SaveError
          ? e.code === "version"
            ? "version"
            : "corrupt"
          : "storage",
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
