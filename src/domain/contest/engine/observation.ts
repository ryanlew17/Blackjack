// @req REQ-2026-023: numeric contributions, authorized information and reversible effects.
// @req REQ-2026-015: UI and strategies receive ONLY these projected values.
import { observeTrumps } from "./effects";
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { contribution, effectiveTotals } from "./contributions";
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
  const cards: NumberCardView[] = state.hands[player].map((card) => {
    const faceDown = card.instanceId === state.hiddenCards[player] && !revealed;
    return {
      value: faceDown && player !== viewer ? null : card.value,
      faceDown,
    };
  });
  return {
    cards,
    visibleTotal:
      state.result?.totals[player] ??
      state.hands[player]
        .filter(
          (card) => revealed || card.instanceId !== state.hiddenCards[player],
        )
        .reduce((sum, card) => sum + contribution(state, player, card), 0),
    total: cards.some((card) => card.value === null)
      ? null
      : (state.result?.totals[player] ?? effectiveTotals(state)[player]),
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
    faceUpCardIds: {
      human: state.hands.human
        .filter((c) => c.instanceId !== state.hiddenCards.human)
        .map((c) => c.instanceId),
      ai: state.hands.ai
        .filter((c) => c.instanceId !== state.hiddenCards.ai)
        .map((c) => c.instanceId),
    },
    hiddenMultipliers: state.hiddenMultipliers,
    peek:
      state.scry[viewer]?.revision === state.deckRevision
        ? state.scry[viewer]!.cards.map((c) => c.value)
        : null,
    pointTarget: state.pointTarget,
    hitDrawCounts: state.hitDrawCounts,
    turn: state.turn,
    quietStays: state.quietStays,
    result: state.result,
    lastPlay: state.lastPlay
      ? {
          type: state.lastPlay.type,
          player: state.lastPlay.player,
          instanceId: state.lastPlay.instanceId,
        }
      : null,
    ...(state.trumps ? { trumps: observeTrumps(state.trumps, viewer) } : {}),
  });
}

export function projectRoundEvent(
  event: RoundEvent,
  viewer: PlayerId,
): RoundEventView {
  const state = observeRound(event.state, viewer);
  switch (event.type) {
    case "resource":
      return freezeData({
        type: event.type,
        player: event.player,
        operation: event.operation,
        cause: event.cause,
        instance:
          event.public || event.player === viewer || event.fromPlayer === viewer
            ? event.instance
            : null,
        ...(event.fromPlayer ? { fromPlayer: event.fromPlayer } : {}),
        state,
      });
    case "trump":
      return freezeData({
        type: event.type,
        player: event.player,
        instance: event.instance,
        effect: event.effect,
        ...(event.card !== undefined ? { card: event.card } : {}),
        ...(event.targetId ? { targetId: event.targetId } : {}),
        ...(event.privateCards !== undefined && event.player === viewer
          ? { privateCards: event.privateCards }
          : {}),
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
