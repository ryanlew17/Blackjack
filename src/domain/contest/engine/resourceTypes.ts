// @req REQ-2026-022: injected resource streams and immutable stock policy.
import type { Difficulty } from "../types";
import type { RandomSource } from "./numbers";

export interface ResourceRandomSources {
  readonly trumpGate: RandomSource;
  readonly trumpSelection: RandomSource;
}
export interface ContestRandomSources extends ResourceRandomSources {
  /** Coin flip and number-deck shuffle only. */
  readonly numbers: RandomSource;
}
export type ContestRandom = RandomSource | ContestRandomSources;

export interface TrumpResourceRules {
  readonly difficulty: Difficulty;
  readonly handLimit: 8;
  readonly gameGrant: 2;
  readonly roundGrant: 1;
  readonly hitProbability: number;
  /** Public initial quantities, never an ordered private inventory. */
  readonly stock: Readonly<Record<string, number>>;
}

export const HIT_PROBABILITIES: Readonly<Record<Difficulty, number>> =
  Object.freeze({
    easy: 0.2,
    standard: 0.3,
    challenge: 0.4,
    danger: 0.5,
    nightmare: 0.6,
  });

export function numberRandom(random: ContestRandom): RandomSource {
  return typeof random === "function" ? random : random.numbers;
}
export function resourceRandom(
  random: ContestRandom | ResourceRandomSources | undefined,
): ResourceRandomSources {
  if (
    !random ||
    typeof random === "function" ||
    typeof random.trumpGate !== "function" ||
    typeof random.trumpSelection !== "function"
  )
    throw new RangeError("Trump resources require separate injected streams");
  return random;
}
