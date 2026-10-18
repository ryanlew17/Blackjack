export type CardId = number;
/** Integer hundredths of a chip. Main wagers are whole chips; insurance may be half. */
export type Money = number;
export type Outcome = "blackjack" | "win" | "lose" | "push" | "surrender";
export type RoundOutcome = Outcome | "mixed";
export type Phase = "betting" | "insurance" | "player" | "dealer" | "settled";
/** @req REQ-2026-003 Rules are injected per call; single-deck identity stays fixed. */
export interface RuleSet {
  version: 2;
  decks: 1;
  standSoft17: boolean;
  blackjackPayout: readonly [3, 2] | readonly [6, 5];
  split: boolean;
  insurance: boolean;
  surrender: boolean;
}
export const RULES: RuleSet = {
  version: 2,
  decks: 1,
  standSoft17: true,
  blackjackPayout: [3, 2],
  split: true,
  insurance: true,
  surrender: true,
};
export interface Hand {
  cards: CardId[];
  bet: Money;
  doubled: boolean;
  status: "active" | "stood" | "busted" | "surrendered";
  outcome: Outcome | null;
}
export interface Insurance {
  bet: Money;
  outcome: "not-offered" | "pending" | "declined" | "win" | "lose";
}
export interface HandRecord {
  bet: Money;
  outcome: Outcome;
  net: Money;
}
export interface RoundRecord {
  round: number;
  originalBet: Money;
  outcome: RoundOutcome;
  bet: Money;
  net: Money;
  hands: HandRecord[];
  insurance: Insurance;
}
export interface GameState {
  phase: Phase;
  balance: Money;
  bets: Money[];
  hands: Hand[];
  activeHand: number;
  originalBet: Money;
  insurance: Insurance;
  dealer: CardId[];
  deck: CardId[];
  round: number;
  outcome: RoundOutcome | null;
  history: RoundRecord[];
}
export type GameCommand =
  | { type: "bet"; amount: Money }
  | {
      type:
        | "undo"
        | "clear"
        | "allIn"
        | "deal"
        | "hit"
        | "stand"
        | "double"
        | "split"
        | "insure"
        | "declineInsurance"
        | "surrender"
        | "next";
    };
export interface GameEvent {
  type: "chip" | "card" | "reveal" | "result";
  state: GameState;
}
const newHand = (cards: CardId[] = [], bet = 0): Hand => ({
  cards,
  bet,
  doubled: false,
  status: "active",
  outcome: null,
});
export const freshGame = (): GameState => ({
  phase: "betting",
  balance: 200000,
  bets: [],
  hands: [newHand()],
  activeHand: 0,
  originalBet: 0,
  insurance: { bet: 0, outcome: "not-offered" },
  dealer: [],
  deck: [],
  round: 0,
  outcome: null,
  history: [],
});
export function score(cards: CardId[]) {
  let total = 0,
    aces = 0;
  for (const c of cards) {
    const r = c % 13;
    total += r === 0 ? 11 : Math.min(r + 1, 10);
    if (r === 0) aces++;
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}
export const cardValue = (card: CardId) => Math.min((card % 13) + 1, 10);
export const rank = (card: CardId) =>
  ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][card % 13];
export const suit = (card: CardId) =>
  ["♠", "♥", "♣", "♦"][Math.floor(card / 13)];
export function shuffle(random: () => number = Math.random): CardId[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export function legalActions(
  s: GameState,
  rules: RuleSet = RULES,
): GameCommand["type"][] {
  if (s.phase === "betting")
    return [
      "bet",
      "allIn",
      ...(s.bets.length ? (["undo", "clear", "deal"] as const) : []),
    ];
  if (s.phase === "settled") return ["next"];
  if (s.phase === "insurance")
    return [
      "declineInsurance",
      ...(rules.insurance && s.balance >= s.originalBet / 2
        ? (["insure"] as const)
        : []),
    ];
  if (s.phase !== "player") return [];
  const h = s.hands[s.activeHand];
  if (!h || h.status !== "active") return [];
  const first = h.cards.length === 2 && !h.doubled;
  return [
    "hit",
    "stand",
    ...(first && s.balance >= h.bet ? (["double"] as const) : []),
    ...(rules.split &&
    first &&
    s.hands.length === 1 &&
    s.balance >= h.bet &&
    cardValue(h.cards[0]) === cardValue(h.cards[1])
      ? (["split"] as const)
      : []),
    ...(rules.surrender && first && s.hands.length === 1
      ? (["surrender"] as const)
      : []),
  ];
}
/** Shared settlement math, also used to verify imported results. */
export function handOutcome(
  h: Hand,
  dealer: CardId[],
  split: boolean,
): Outcome {
  const p = score(h.cards).total,
    d = score(dealer).total;
  const naturalP = !split && h.cards.length === 2 && p === 21;
  const naturalD = dealer.length === 2 && d === 21;
  if (naturalD) return naturalP ? "push" : "lose";
  if (naturalP) return "blackjack";
  if (h.status === "surrendered") return "surrender";
  if (p > 21) return "lose";
  return d > 21 || p > d ? "win" : p === d ? "push" : "lose";
}
export function handNet(
  bet: Money,
  outcome: Outcome,
  rules: RuleSet = RULES,
): Money {
  return outcome === "blackjack"
    ? (bet / rules.blackjackPayout[1]) * rules.blackjackPayout[0]
    : outcome === "win"
      ? bet
      : outcome === "push"
        ? 0
        : outcome === "surrender"
          ? -bet / 2
          : -bet;
}
// Accumulate exactly before converting back; no rounded unsafe intermediate sums.
const sumMoney = (...values: number[]) => {
  if (values.some((v) => !Number.isSafeInteger(v))) return NaN;
  const sum = values.reduce((n, v) => n + BigInt(v), 0n);
  return sum > BigInt(Number.MAX_SAFE_INTEGER) ||
    sum < -BigInt(Number.MAX_SAFE_INTEGER)
    ? NaN
    : Number(sum);
};
export const insuranceNet = (i: Insurance) =>
  i.outcome === "win" ? i.bet * 2 : i.outcome === "lose" ? -i.bet : 0;
export function summarizeRound(
  round: number,
  originalBet: Money,
  hands: HandRecord[],
  insurance: Insurance,
): RoundRecord {
  return {
    round,
    originalBet,
    hands,
    insurance: { ...insurance },
    outcome: hands.every((h) => h.outcome === hands[0].outcome)
      ? hands[0].outcome
      : "mixed",
    bet: sumMoney(insurance.bet, ...hands.map((h) => h.bet)),
    net: sumMoney(insuranceNet(insurance), ...hands.map((h) => h.net)),
  };
}
export const totalWager = (s: GameState) =>
  sumMoney(s.insurance.bet, ...s.hands.map((h) => h.bet));
/** @req REQ-2026-003 Authoritative results are computed before any event replay. */
export function transition(
  previous: GameState,
  command: GameCommand,
  random: () => number = Math.random,
  rules: RuleSet = RULES,
): { state: GameState; events: GameEvent[] } {
  const unchanged = { state: previous, events: [] };
  if (!legalActions(previous, rules).includes(command.type)) return unchanged;
  const s = structuredClone(previous),
    events: GameEvent[] = [];
  let hand = s.hands[s.activeHand];
  const emit = (type: GameEvent["type"]) =>
    events.push({ type, state: structuredClone(s) });
  const draw = () => {
    const c = s.deck.shift();
    if (c === undefined) throw new Error("Empty deck");
    return c;
  };
  const settle = () => {
    const records = s.hands.map((h) => {
      const outcome = handOutcome(h, s.dealer, s.hands.length > 1);
      h.outcome = outcome;
      if (h.status === "active") h.status = "stood";
      const net = handNet(h.bet, outcome, rules);
      s.balance = sumMoney(s.balance, h.bet, net);
      return { bet: h.bet, outcome, net };
    });
    const record = summarizeRound(s.round, s.originalBet, records, s.insurance);
    s.outcome = record.outcome;
    s.phase = "settled";
    s.activeHand = 0;
    s.history = [record, ...s.history].slice(0, 30);
    emit("result");
  };
  const revealAndSettle = () => {
    s.phase = "dealer";
    emit("reveal");
    settle();
  };
  const advance = () => {
    const next = s.hands.findIndex((h) => h.status === "active");
    if (next >= 0) {
      s.activeHand = next;
      return;
    }
    s.phase = "dealer";
    emit("reveal");
    if (s.hands.some((h) => h.status === "stood")) {
      let d = score(s.dealer);
      while (d.total < 17 || (d.total === 17 && d.soft && !rules.standSoft17)) {
        s.dealer.push(draw());
        emit("card");
        d = score(s.dealer);
      }
    }
    settle();
  };
  const afterHit = () => {
    const p = score(hand.cards).total;
    if (p > 21) hand.status = "busted";
    else if (p === 21 || hand.doubled) hand.status = "stood";
    advance();
  };
  const checkNaturals = () => {
    s.phase = "player";
    if (score(hand.cards).total === 21 || score(s.dealer).total === 21)
      revealAndSettle();
  };
  switch (command.type) {
    case "bet":
      if (
        !Number.isSafeInteger(command.amount) ||
        command.amount < 100 ||
        command.amount % 100 ||
        command.amount > s.balance ||
        s.bets.length >= 1000
      )
        return unchanged;
      s.balance -= command.amount;
      s.bets.push(command.amount);
      hand.bet += command.amount;
      emit("chip");
      break;
    case "undo": {
      const amount = s.bets.pop()!;
      s.balance += amount;
      hand.bet -= amount;
      emit("chip");
      break;
    }
    case "clear":
      s.balance += hand.bet;
      hand.bet = 0;
      s.bets = [];
      emit("chip");
      break;
    case "allIn": {
      const amount = Math.floor((s.balance + hand.bet) / 100) * 100;
      if (!amount) return unchanged;
      s.balance += hand.bet - amount;
      hand.bet = amount;
      s.bets = [amount];
      emit("chip");
      break;
    }
    case "deal":
      s.round++;
      s.originalBet = hand.bet;
      s.deck = shuffle(random);
      s.phase = "player";
      s.bets = [];
      for (let i = 0; i < 2; i++) {
        hand.cards.push(draw());
        emit("card");
        s.dealer.push(draw());
        emit("card");
      }
      if (rules.insurance && s.dealer[0] % 13 === 0) {
        s.phase = "insurance";
        s.insurance.outcome = "pending";
      } else checkNaturals();
      break;
    // @req REQ-2026-005 Insurance is resolved exactly once, before natural checks.
    case "insure":
    case "declineInsurance":
      if (command.type === "insure") {
        s.insurance.bet = s.originalBet / 2;
        s.balance -= s.insurance.bet;
        s.insurance.outcome = score(s.dealer).total === 21 ? "win" : "lose";
        s.balance = sumMoney(
          s.balance,
          s.insurance.outcome === "win" ? s.insurance.bet * 3 : 0,
        );
        emit("chip");
      } else s.insurance.outcome = "declined";
      checkNaturals();
      break;
    case "hit":
      hand.cards.push(draw());
      emit("card");
      afterHit();
      break;
    case "stand":
      hand.status = "stood";
      advance();
      break;
    case "double":
      s.balance -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      emit("chip");
      hand.cards.push(draw());
      emit("card");
      afterHit();
      break;
    // @req REQ-2026-004 Two hands only; split aces receive one card each.
    case "split": {
      s.balance -= hand.bet;
      s.hands = [
        newHand([hand.cards[0]], hand.bet),
        newHand([hand.cards[1]], hand.bet),
      ];
      emit("chip");
      for (const h of s.hands) {
        h.cards.push(draw());
        if (h.cards[0] % 13 === 0 || score(h.cards).total === 21)
          h.status = "stood";
        emit("card");
      }
      hand = s.hands[0];
      advance();
      break;
    }
    // @req REQ-2026-006 Insurance losses remain included in the round record.
    case "surrender":
      hand.status = "surrendered";
      revealAndSettle();
      break;
    case "next": {
      const { balance, round, history } = s;
      Object.assign(s, freshGame(), { balance, round, history });
      break;
    }
  }
  // No fixed bankroll cap. Reject only a transition whose monetary results cannot be represented safely.
  const safe = (n: number) => Number.isSafeInteger(n);
  if (
    !safe(s.balance) ||
    !safe(s.round) ||
    !safe(totalWager(s)) ||
    (s.phase === "betting" && !safe(sumMoney(s.balance, totalWager(s)))) ||
    s.hands.some((h) => !safe(h.bet)) ||
    s.history.some(
      (r) => !safe(r.bet) || !safe(r.net) || r.hands.some((h) => !safe(h.net)),
    )
  )
    return unchanged;
  return { state: s, events };
}
