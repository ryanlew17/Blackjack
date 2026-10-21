// @req REQ-2026-024: Game cleanup also removes the Sudden Death marker.
// @req REQ-2026-023: numeric contributions, authorized information and reversible effects.
// @req REQ-2026-016/022: remove effect records without reviving destroyed card bodies.
import type { RoundState } from "./types";

/** Keep revealed numbers/result and unplayed resources for the next Round. */
export function cleanupRound(round: RoundState): RoundState {
  return {
    ...round,
    ...(round.trumps ? { trumps: { ...round.trumps, table: [] } } : {}),
    pointTarget: round.rules.pointTarget,
    hitDrawCounts: { human: 1, ai: 1 },
    hiddenMultipliers: { human: 1, ai: 1 },
    scry: { human: null, ai: null },
    turn: null,
    quietStays: 0,
    lastPlay: null,
  };
}
/** Every Game gets a new namespace/stock; nothing from the old stock is recycled. */
export function cleanupGame(round: RoundState): RoundState {
  const { suddenDeath: _marker, ...clean } = cleanupRound(round);
  return clean.trumps
    ? {
        ...clean,
        trumps: {
          ...clean.trumps,
          hands: { human: [], ai: [] },
          stock: { human: [], ai: [] },
          table: [],
          destroyed: [],
          nextGeneratedId: 1,
          nextEffectId: 1,
        },
      }
    : clean;
}
