// @req REQ-2026-016: extend these boundaries with trump cleanup in REQ-019/S2.
import type { RoundState } from "./types";

/** Keep revealed cards and the result for presentation; clear round modifiers.
 * No table effects or resource inventory exist on the no-trump path yet.
 */
export function cleanupRound(round: RoundState): RoundState {
  return {
    ...round,
    pointTarget: round.rules.pointTarget,
    turn: null,
    quietStays: 0,
  };
}
