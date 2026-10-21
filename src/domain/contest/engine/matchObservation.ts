// @req REQ-2026-024: project the authoritative score breakdown.
// @req REQ-2026-016: match scores are public; round secrets remain projected.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { observeRound, projectRoundEvent } from "./observation";
import type {
  MatchEvent,
  MatchEventView,
  MatchObservation,
  MatchState,
  MatchTransition,
  MatchTransitionView,
} from "./types";

export function observeMatch(
  state: MatchState,
  viewer: PlayerId,
): MatchObservation {
  return freezeData({
    rules: state.rules,
    phase: state.phase,
    wins: state.wins,
    game: state.game,
    roundNumber: state.roundNumber,
    round: observeRound(state.round, viewer),
    winner: state.winner,
  });
}

export function projectMatchEvent(
  event: MatchEvent,
  viewer: PlayerId,
): MatchEventView {
  const state = observeMatch(event.state, viewer);
  switch (event.type) {
    case "round":
      return freezeData({
        type: event.type,
        event: projectRoundEvent(event.event, viewer),
        state,
      });
    case "round-scored":
      return freezeData({
        type: event.type,
        winner: event.winner,
        score: event.score,
        state,
      });
    case "game-won":
      return freezeData({ type: event.type, winner: event.winner, state });
    case "match-won":
      return freezeData({ type: event.type, winner: event.winner, state });
    case "target-extended":
      return freezeData({
        type: event.type,
        from: event.from,
        to: event.to,
        state,
      });
    case "round-cleanup":
    case "game-cleanup":
      return freezeData({ type: event.type, state });
  }
}

export function projectMatchTransition(
  result: MatchTransition,
  viewer: PlayerId,
): MatchTransitionView {
  return freezeData({
    state: observeMatch(result.state, viewer),
    events: result.events.map((event) => projectMatchEvent(event, viewer)),
  });
}
