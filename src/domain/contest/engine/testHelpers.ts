// @req REQ-2026-015: contest-only deterministic fixtures, never a production API.
import type { NumberValue, PlayerId } from "../types";
import { createRound } from "./transition";
import { NUMBER_VALUES } from "./numbers";
import type { RandomSource } from "./numbers";
import type { RoundRules, RoundState } from "./types";
import { transition } from "./transition";

/** Complete a draw-order prefix, then invert this engine's 11-card shuffle. */
export function fixedRandom(prefix: readonly NumberValue[]): RandomSource {
  if (
    prefix.some((value) => !NUMBER_VALUES.includes(value)) ||
    new Set(prefix).size !== prefix.length
  )
    throw new Error("Invalid contest draw-order prefix");
  const order = [
    ...prefix,
    ...NUMBER_VALUES.filter((card) => !prefix.includes(card)),
  ];
  const working = [...NUMBER_VALUES];
  const values: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(order[i]);
    values.push((j + 0.5) / (i + 1));
    [working[i], working[j]] = [working[j], working[i]];
  }
  let index = 0;
  return () => {
    if (index >= values.length)
      throw new Error("Unexpected random consumption");
    return values[index++];
  };
}

export const fixedRound = (
  prefix: readonly NumberValue[],
  firstPlayer: PlayerId = "human",
  rules?: RoundRules,
) => createRound(firstPlayer, fixedRandom(prefix), rules);

export function act(state: RoundState, type: "Hit" | "Stay") {
  if (!state.turn) throw new Error("Fixture has no active turn");
  return transition(state, { type, player: state.turn.player });
}

export const settle = (state: RoundState) =>
  act(act(state, "Stay").state, "Stay");
