// @req REQ-2026-023: numeric contributions, authorized information and reversible effects.
// @req REQ-2026-022: instance identity/resource migration preserves existing rule regressions.
// @req REQ-2026-015: compare final faces only; there is no natural priority.
import type { NumberInstance } from "./numberCards";
import type { NumberValue, PlayerId } from "../types";
import { numberTotal } from "./numbers";
import type { RoundResult } from "./types";

export function compareHands(
  hands: Readonly<Record<PlayerId, readonly (NumberValue | NumberInstance)[]>>,
  pointTarget: number,
): RoundResult {
  return compareTotals(
    { human: numberTotal(hands.human), ai: numberTotal(hands.ai) },
    pointTarget,
  );
}

export function compareTotals(
  totals: Readonly<Record<PlayerId, number>>,
  pointTarget: number,
): RoundResult {
  const { human, ai } = totals;
  const humanBust = human > pointTarget;
  const aiBust = ai > pointTarget;
  let winner: PlayerId | null = null;
  if (human !== ai) {
    if (humanBust !== aiBust) winner = humanBust ? "ai" : "human";
    else if (humanBust) winner = human < ai ? "human" : "ai";
    else winner = human > ai ? "human" : "ai";
  }
  return { winner, totals: { human, ai }, pointTarget };
}
