// @req REQ-2026-015: every command commits its full outcome before replay.
import { playTrump } from "./effects";
import type { TrumpState } from "./effectTypes";
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { compareHands } from "./comparison";
import { legalActions } from "./legalActions";
import { createNumberDeck } from "./numbers";
import type { RandomSource } from "./numbers";
import { observeRound } from "./observation";
import { DEFAULT_ROUND_RULES, snapshotRoundRules } from "./rules";
import { nextTurn, opponentOf } from "./turn";
import type {
  RoundCommand,
  RoundEvent,
  RoundRules,
  RoundState,
  RoundTransition,
} from "./types";

/** Match lifecycle chooses firstPlayer. This entry only creates one Round.
 * Randomness is consumed only for this shuffle; later commands draw in order.
 */
export function createRound(
  firstPlayer: PlayerId,
  random: RandomSource,
  rules: RoundRules = DEFAULT_ROUND_RULES,
  trumps?: TrumpState,
): RoundTransition {
  if (firstPlayer !== "human" && firstPlayer !== "ai")
    throw new RangeError("Invalid first player");
  const snapshot = snapshotRoundRules(rules);
  let state: RoundState = freezeData({
    rules: snapshot,
    ...(trumps ? { trumps } : {}),
    firstPlayer,
    phase: "dealing",
    hands: { human: [], ai: [] },
    deck: createNumberDeck(random),
    pointTarget: snapshot.pointTarget,
    turn: null,
    quietStays: 0,
    revealed: [],
    result: null,
  });
  const events: RoundEvent[] = [];
  const order = [firstPlayer, opponentOf(firstPlayer)];
  for (let index = 0; index < 2; index++) {
    for (const player of order) {
      const card = state.deck[0];
      const complete = index === 1 && player === order[1];
      state = freezeData({
        ...state,
        hands: { ...state.hands, [player]: [...state.hands[player], card] },
        deck: state.deck.slice(1),
        phase: complete ? "acting" : "dealing",
        turn: complete
          ? { player: firstPlayer, number: 1, usedTrump: false }
          : null,
      });
      events.push({ type: "deal", player, card, index, state });
    }
  }
  return freezeData({ state, events });
}

export function transition(
  original: RoundState,
  command: RoundCommand,
): RoundTransition {
  // Validate at the authority boundary, including untyped/stale UI commands.
  if (
    (command.player !== "human" && command.player !== "ai") ||
    !legalActions(observeRound(original, command.player)).includes(command.type)
  )
    return { state: original, events: [] };

  if (command.type === "PlayTrump")
    return playTrump(original, command, observeRound(original, command.player));
  const turn = original.turn!;
  if (command.type === "Hit") {
    const card = original.deck[0];
    const state: RoundState = freezeData({
      ...original,
      hands: {
        ...original.hands,
        [command.player]: [...original.hands[command.player], card],
      },
      deck: original.deck.slice(1),
      turn: nextTurn(turn),
      quietStays: 0,
    });
    return freezeData({
      state,
      events: [{ type: "hit", player: command.player, card, state }],
    });
  }

  const quiet = !turn.usedTrump;
  const quietStays = quiet ? ((original.quietStays + 1) as 1 | 2) : 0;
  const closing = quietStays === 2;
  let state: RoundState = freezeData({
    ...original,
    phase: closing ? "revealing" : "acting",
    turn: closing ? null : nextTurn(turn),
    quietStays,
  });
  const events: RoundEvent[] = [
    { type: "stay", player: command.player, quiet, state },
  ];
  if (closing) {
    for (const player of [state.firstPlayer, opponentOf(state.firstPlayer)]) {
      state = freezeData({ ...state, revealed: [...state.revealed, player] });
      events.push({
        type: "reveal",
        player,
        card: state.hands[player][0],
        state,
      });
    }
    const result = compareHands(state.hands, state.pointTarget);
    state = freezeData({ ...state, phase: "settled", result });
    events.push({ type: "settled", result, state });
  }
  return freezeData({ state, events });
}
