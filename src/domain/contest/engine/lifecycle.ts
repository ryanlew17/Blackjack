// @req REQ-2026-016: extend these boundaries with trump cleanup in REQ-019/S2.
import type { RoundState } from "./types";

/** Keep revealed cards and the result for presentation; clear round modifiers.
 * Table instances move to discarded; the no-trump path keeps its original shape.
 */
export function cleanupRound(round: RoundState): RoundState {
  return {
    ...round,
    ...(round.trumps
      ? {
          trumps: {
            ...round.trumps,
            table: [],
            discarded: [
              ...round.trumps.discarded,
              ...round.trumps.table.map(({ instanceId, definitionId }) => ({
                instanceId,
                definitionId,
              })),
            ],
          },
        }
      : {}),
    pointTarget: round.rules.pointTarget,
    turn: null,
    quietStays: 0,
  };
}

/** Game teardown drops all per-Game resources, including unplayed private hands. */
export function cleanupGame(round: RoundState): RoundState {
  const clean = cleanupRound(round);
  return clean.trumps
    ? {
        ...clean,
        trumps: { hands: { human: [], ai: [] }, table: [], discarded: [] },
      }
    : clean;
}
