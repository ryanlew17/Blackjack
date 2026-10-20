// @req REQ-2026-015: internal seam for REQ-019, not a public player command.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import type { RoundState, TurnState } from "./types";

export const opponentOf = (player: PlayerId): PlayerId =>
  player === "human" ? "ai" : "human";

export const nextTurn = (turn: TurnState): TurnState => ({
  player: opponentOf(turn.player),
  number: turn.number + 1,
  usedTrump: false,
});

/** Call only AFTER a future trump executor validates and consumes its resource.
 * Resolution failure still counts as consumption; illegal attempts never call it.
 * This helper grants no card, performs no effect, and never hands over the turn.
 */
export function recordTrumpConsumption(
  state: RoundState,
  player: PlayerId,
): RoundState {
  if (state.phase !== "acting" || state.turn?.player !== player) return state;
  return freezeData({
    ...state,
    quietStays: 0,
    turn: { ...state.turn, usedTrump: true },
  });
}
