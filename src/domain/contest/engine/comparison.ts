// @req REQ-2026-015: compare final faces only; there is no natural priority.
import type { NumberValue, PlayerId } from "../types";
import { numberTotal } from "./numbers";
import type { RoundResult } from "./types";

export function compareHands(
  hands: Readonly<Record<PlayerId, readonly NumberValue[]>>,
  pointTarget: number,
): RoundResult {
  const human = numberTotal(hands.human);
  const ai = numberTotal(hands.ai);
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
