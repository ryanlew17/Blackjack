// @req REQ-2026-027: stable, scoped reaction authorization independent of secret spending.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { opponentOf } from "./turn";
import type { RoundState, RoundTransition } from "./types";

export interface ReactionState {
  readonly boundary: number;
  readonly turnNumber: number;
  readonly passed: boolean;
}
export interface ReactionView {
  readonly player: PlayerId;
  readonly turnNumber: number;
  readonly boundary: number;
}
export interface PassReactionCommand {
  readonly type: "PassReaction";
  readonly player: PlayerId;
  readonly turnNumber: number;
  readonly reactionBoundary: number;
}

/** Eligibility uses the publicly known upper bound, never a secret use or permission. */
export function observeReaction(state: RoundState): ReactionView | undefined {
  if (
    state.phase !== "acting" ||
    !state.turn ||
    !state.reactionState ||
    state.reactionState.turnNumber !== state.turn.number ||
    state.reactionState.passed
  )
    return undefined;
  const player = opponentOf(state.turn.player);
  if (
    state.rules.skills?.selected[player] !== "twin-bloom" ||
    !!state.skills?.seal ||
    !!state.skills?.players[player].disabled ||
    !state.skills ||
    state.skills.players[player].publicRemainingUses <= 0
  )
    return undefined;
  return {
    player,
    turnNumber: state.turn.number,
    boundary: state.reactionState.boundary,
  };
}

/** Only the final frame authorizes the next command; intermediate replay never opens a window. */
export function completeReactionBoundary(
  result: RoundTransition,
): RoundTransition {
  const original = result.state;
  if (
    !original.rules.skills ||
    !Object.values(original.rules.skills.selected).includes("twin-bloom")
  )
    return result;
  const state = freezeData({
    ...original,
    reactionState: {
      boundary: (original.reactionState?.boundary ?? 0) + 1,
      turnNumber: original.turn?.number ?? 0,
      passed: false,
    },
  });
  return freezeData({
    state,
    events: result.events.map((event, index) =>
      index === result.events.length - 1 ? { ...event, state } : event,
    ),
  });
}

/** A common explicit pass follows either secret preparation or a declined opportunity. */
export function passReaction(
  original: RoundState,
  command: PassReactionCommand,
): RoundTransition {
  const reaction = observeReaction(original);
  if (
    !reaction ||
    command.player !== reaction.player ||
    command.turnNumber !== reaction.turnNumber ||
    command.reactionBoundary !== reaction.boundary
  )
    return { state: original, events: [] };
  return freezeData({
    state: {
      ...original,
      reactionState: { ...original.reactionState!, passed: true },
    },
    events: [],
  });
}
