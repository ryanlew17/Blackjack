export type CardId = number;
/** Integer hundredths of a chip. */
export type Money = number;
export type Outcome = "blackjack" | "win" | "lose" | "push";
export type Phase = "betting" | "player" | "dealer" | "settled";
/**
 * Declarative record of the table rules. `standSoft17` and
 * `blackjackPayout` are wired into `transition` and accept the common
 * variants; every other field is pinned to the only implemented value.
 * Multi-deck changes card identity and the save format's 52-card
 * coverage check, and split/insurance/surrender are roadmap features —
 * changing a pinned field means implementing the rule and bumping
 * rulesVersion in save.ts.
 */
export interface RuleSet {
  version: 1;
  decks: 1;
  standSoft17: boolean;
  blackjackPayout: readonly [3, 2] | readonly [6, 5];
  split: false;
  insurance: false;
  surrender: false;
}
export const RULES: RuleSet = {
  version: 1,
  decks: 1,
  standSoft17: true,
  blackjackPayout: [3, 2],
  split: false,
  insurance: false,
  surrender: false,
};
export interface Hand {
  cards: CardId[];
  bet: Money;
  doubled: boolean;
}
export interface RoundRecord {
  round: number;
  outcome: Outcome;
  bet: Money;
  net: Money;
}
export interface GameState {
  phase: Phase;
  balance: Money;
  bets: Money[];
  hands: Hand[];
  dealer: CardId[];
  deck: CardId[];
  round: number;
  outcome: Outcome | null;
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
        | "next";
    };
export interface GameEvent {
  type: "chip" | "card" | "reveal" | "result";
  state: GameState;
}
export const freshGame = (): GameState => ({
  phase: "betting",
  balance: 200000,
  bets: [],
  hands: [{ cards: [], bet: 0, doubled: false }],
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
export function legalActions(s: GameState): GameCommand["type"][] {
  if (s.phase === "betting")
    return [
      "bet",
      "allIn",
      ...(s.bets.length ? (["undo", "clear", "deal"] as const) : []),
    ];
  if (s.phase === "settled") return ["next"];
  if (s.phase !== "player") return [];
  return [
    "hit",
    "stand",
    ...(s.hands[0].cards.length === 2 &&
    !s.hands[0].doubled &&
    s.balance >= s.hands[0].bet
      ? (["double"] as const)
      : []),
  ];
}
export function transition(
  previous: GameState,
  command: GameCommand,
  random: () => number = Math.random,
  rules: RuleSet = RULES,
): { state: GameState; events: GameEvent[] } {
  if (!legalActions(previous).includes(command.type))
    return { state: previous, events: [] };
  const s = structuredClone(previous),
    events: GameEvent[] = [],
    hand = s.hands[0];
  const emit = (type: GameEvent["type"]) =>
    events.push({ type, state: structuredClone(s) });
  const draw = () => {
    const c = s.deck.shift();
    if (c === undefined) throw new Error("Empty deck");
    return c;
  };
  const settle = (outcome: Outcome) => {
    s.outcome = outcome;
    s.phase = "settled";
    const returned =
      outcome === "blackjack"
        ? hand.bet +
          (hand.bet * rules.blackjackPayout[0]) / rules.blackjackPayout[1]
        : outcome === "win"
          ? hand.bet * 2
          : outcome === "push"
            ? hand.bet
            : 0;
    s.balance += returned;
    s.history = [
      { round: s.round, outcome, bet: hand.bet, net: returned - hand.bet },
      ...s.history,
    ].slice(0, 30);
    emit("result");
  };
  const dealerTurn = () => {
    s.phase = "dealer";
    emit("reveal");
    let dealerScore = score(s.dealer);
    while (
      dealerScore.total < 17 ||
      (dealerScore.total === 17 && dealerScore.soft && !rules.standSoft17)
    ) {
      s.dealer.push(draw());
      emit("card");
      dealerScore = score(s.dealer);
    }
    const p = score(hand.cards).total,
      d = dealerScore.total;
    settle(d > 21 || p > d ? "win" : p === d ? "push" : "lose");
  };
  const afterHit = () => {
    const total = score(hand.cards).total;
    if (total > 21) {
      s.phase = "dealer";
      emit("reveal");
      settle("lose");
    } else if (total === 21 || hand.doubled) dealerTurn();
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
        return { state: previous, events: [] };
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
      if (!amount) return { state: previous, events: [] };
      s.balance += hand.bet - amount;
      hand.bet = amount;
      s.bets = [amount];
      emit("chip");
      break;
    }
    case "deal":
      s.round++;
      s.deck = shuffle(random);
      s.phase = "player";
      s.bets = [];
      for (let i = 0; i < 2; i++) {
        hand.cards.push(draw());
        emit("card");
        s.dealer.push(draw());
        emit("card");
      }
      {
        const p = score(hand.cards).total === 21,
          d = score(s.dealer).total === 21;
        if (p || d) {
          s.phase = "dealer";
          emit("reveal");
          settle(p && d ? "push" : p ? "blackjack" : "lose");
        }
      }
      break;
    case "hit":
      hand.cards.push(draw());
      emit("card");
      afterHit();
      break;
    case "stand":
      dealerTurn();
      break;
    case "double":
      s.balance -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      emit("chip");
      hand.cards.push(draw());
      emit("card");
      if (score(hand.cards).total < 21) dealerTurn();
      else afterHit();
      break;
    case "next":
      s.phase = "betting";
      s.hands = [{ cards: [], bet: 0, doubled: false }];
      s.dealer = [];
      s.deck = [];
      s.outcome = null;
      break;
  }
  return { state: s, events };
}
