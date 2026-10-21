// @req REQ-2026-022: instance identity/resource migration preserves existing rule regressions.
// @req REQ-2026-015: contest numbers have no suits, aces or classic shoe rules.
import type { NumberInstance } from "./numberCards";
import type { NumberValue } from "../types";

export type RandomSource = () => number;
export const NUMBER_VALUES: readonly NumberValue[] = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
]);

export function randomUnit(random: RandomSource): number {
  if (typeof random !== "function")
    throw new RangeError("Missing random source");
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new RangeError("Random source must return a value in [0, 1)");
  return value;
}

export function createNumberDeck(random: RandomSource): NumberValue[] {
  const deck = [...NUMBER_VALUES];
  for (let i = deck.length - 1; i > 0; i--) {
    const value = randomUnit(random);
    const j = Math.floor(value * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const numberTotal = (
  cards: readonly (NumberValue | NumberInstance)[],
): number =>
  cards.reduce<number>(
    (total, card) => total + (typeof card === "number" ? card : card.value),
    0,
  );
