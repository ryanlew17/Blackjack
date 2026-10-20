// @req REQ-2026-015: contest numbers have no suits, aces or classic shoe rules.
import type { NumberValue } from "../types";

export type RandomSource = () => number;
export const NUMBER_VALUES: readonly NumberValue[] = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
]);

export function createNumberDeck(random: RandomSource): NumberValue[] {
  const deck = [...NUMBER_VALUES];
  for (let i = deck.length - 1; i > 0; i--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new RangeError("Random source must return a value in [0, 1)");
    const j = Math.floor(value * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const numberTotal = (cards: readonly NumberValue[]): number =>
  cards.reduce<number>((total, card) => total + card, 0);
