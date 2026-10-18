import {
  freshGame,
  RULES,
  transition,
  type CardId,
  type RuleSet,
} from "./game";
export function fixedRandom(prefix: CardId[]) {
  const target = [
    ...prefix,
    ...Array.from({ length: 52 }, (_, i) => i).filter(
      (c) => !prefix.includes(c),
    ),
  ];
  const working = Array.from({ length: 52 }, (_, i) => i),
    values: number[] = [];
  for (let i = 51; i > 0; i--) {
    const j = working.indexOf(target[i]);
    values.push((j + 0.1) / (i + 1));
    [working[i], working[j]] = [working[j], working[i]];
  }
  let n = 0;
  return () => values[n++];
}
export function dealt(prefix: CardId[], bet = 1000, rules: RuleSet = RULES) {
  const s = transition(freshGame(), { type: "bet", amount: bet }).state;
  return transition(s, { type: "deal" }, fixedRandom(prefix), rules).state;
}
