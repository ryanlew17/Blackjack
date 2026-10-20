// @req REQ-2026-015: UI and strategies receive ONLY these projected values.
import { observeTrumps } from "./effects";
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { numberTotal } from "./numbers";
import type {
  NumberCardView,
  RoundEvent,
  RoundEventView,
  RoundHandView,
  RoundObservation,
  RoundState,
  RoundTransition,
  RoundTransitionView,
} from "./types";

function handView(
  state: RoundState,
  player: PlayerId,
  viewer: PlayerId,
): RoundHandView {
  const revealed = state.revealed.includes(player);
  const cards: NumberCardView[] = state.hands[player].map((value, index) => {
    const faceDown = index === 0 && !revealed;
    return { value: faceDown && player !== viewer ? null : value, faceDown };
  });
  return {
    cards,
    visibleTotal: numberTotal(state.hands[player].slice(revealed ? 0 : 1)),
    total: cards.some((card) => card.value === null)
      ? null
      : numberTotal(state.hands[player]),
  };
}

export function observeRound(
  state: RoundState,
  viewer: PlayerId,
): RoundObservation {
  return freezeData({
    viewer,
    rules: state.rules,
    firstPlayer: state.firstPlayer,
    phase: state.phase,
    hands: {
      human: handView(state, "human", viewer),
      ai: handView(state, "ai", viewer),
    },
    deckCount: state.deck.length,
    pointTarget: state.pointTarget,
    turn: state.turn,
    quietStays: state.quietStays,
    result: state.result,
    ...(state.trumps ? { trumps: observeTrumps(state.trumps, viewer) } : {}),
  });
}

export function projectRoundEvent(
  event: RoundEvent,
  viewer: PlayerId,
): RoundEventView {
  const state = observeRound(event.state, viewer);
  switch (event.type) {
    case "trump":
      return freezeData({
        type: event.type,
        player: event.player,
        instance: event.instance,
        effect: event.effect,
        ...(event.card !== undefined ? { card: event.card } : {}),
        ...(event.targetId ? { targetId: event.targetId } : {}),
        state,
      });
    case "deal":
      return freezeData({
        type: event.type,
        player: event.player,
        index: event.index,
        card: state.hands[event.player].cards[event.index],
        state,
      });
    case "hit":
    case "reveal":
      return freezeData({
        type: event.type,
        player: event.player,
        card: { value: event.card, faceDown: false },
        state,
      });
    case "stay":
      return freezeData({
        type: event.type,
        player: event.player,
        quiet: event.quiet,
        state,
      });
    case "settled":
      return freezeData({ type: event.type, result: event.result, state });
  }
}

export function projectRoundTransition(
  result: RoundTransition,
  viewer: PlayerId,
): RoundTransitionView {
  return freezeData({
    state: observeRound(result.state, viewer),
    events: result.events.map((event) => projectRoundEvent(event, viewer)),
  });
}
