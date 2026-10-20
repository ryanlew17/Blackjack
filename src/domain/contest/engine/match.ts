// @req REQ-2026-016: compose round results into a standard BO5 in memory.
import { freezeData } from "../immutable";
import { legalActions } from "./legalActions";
import { cleanupRound } from "./lifecycle";
import type { RandomSource } from "./numbers";
import { observeMatch } from "./matchObservation";
import { createMatchRules } from "./rules";
import { createContestGame, scoreContestRound } from "./scoring";
import { createRound, transition } from "./transition";
import { opponentOf } from "./turn";
import type {
  MatchCommand,
  MatchEvent,
  MatchObservation,
  MatchState,
  MatchTransition,
  RoundRules,
  RoundTransition,
} from "./types";

function liftRoundEvents(
  state: MatchState,
  result: RoundTransition,
): MatchEvent[] {
  return result.events.map((event) => ({
    type: "round",
    event,
    state: freezeData({
      ...state,
      round: event.state,
      phase: event.state.phase === "settled" ? "resolving" : "playing",
    }),
  }));
}

export function createMatch(
  random: RandomSource,
  roundRules?: RoundRules,
): MatchTransition {
  const rules = createMatchRules(roundRules);
  // The only coin flip in a Match. Later starts alternate, including ties.
  const firstPlayer = random() < 0.5 ? "human" : "ai";
  const round = createRound(firstPlayer, random, rules.round);
  const state: MatchState = freezeData({
    rules,
    phase: "playing",
    wins: { human: 0, ai: 0 },
    game: createContestGame(1, rules),
    roundNumber: 1,
    round: round.state,
    winner: null,
  });
  return freezeData({ state, events: liftRoundEvents(state, round) });
}

export function legalMatchActions(
  view: MatchObservation,
): readonly MatchCommand["type"][] {
  if (view.phase === "playing") return legalActions(view.round);
  if (view.phase === "round-complete" || view.phase === "game-complete")
    return ["NextRound"];
  return [];
}

export function transitionMatch(
  original: MatchState,
  command: MatchCommand,
  random: RandomSource,
): MatchTransition {
  const viewer = command.type === "NextRound" ? "human" : command.player;
  if (
    command.roundNumber !== original.roundNumber ||
    !legalMatchActions(observeMatch(original, viewer)).includes(command.type)
  )
    return { state: original, events: [] };

  if (command.type === "NextRound") {
    const round = createRound(
      opponentOf(original.round.firstPlayer),
      random,
      original.rules.round,
    );
    const state: MatchState = freezeData({
      ...original,
      phase: "playing",
      game:
        original.phase === "game-complete"
          ? createContestGame(original.game.number + 1, original.rules)
          : original.game,
      roundNumber: original.roundNumber + 1,
      round: round.state,
    });
    return freezeData({ state, events: liftRoundEvents(state, round) });
  }

  const round = transition(original.round, command);
  if (round.state === original.round) return { state: original, events: [] };
  let state: MatchState = freezeData({ ...original, round: round.state });
  const events = liftRoundEvents(original, round);
  if (round.state.phase !== "settled") return freezeData({ state, events });

  const result = round.state.result!;
  const game = scoreContestRound(original.game, result.winner, original.rules);
  state = freezeData({
    ...state,
    phase: "resolving",
    game: { ...game, target: original.game.target, winner: null },
  });
  events.push({ type: "round-scored", winner: result.winner, state });
  if (game.target !== original.game.target) {
    state = freezeData({
      ...state,
      game: { ...state.game, target: game.target },
    });
    events.push({
      type: "target-extended",
      from: original.game.target,
      to: game.target,
      state,
    });
  }

  state = freezeData({
    ...state,
    phase: game.winner ? "resolving" : "round-complete",
    round: cleanupRound(state.round),
  });
  events.push({ type: "round-cleanup", state });
  if (game.winner) {
    const wins = { ...state.wins, [game.winner]: state.wins[game.winner] + 1 };
    const matchWinner =
      wins[game.winner] >= state.rules.gamesToWin ? game.winner : null;
    state = freezeData({ ...state, game, wins });
    events.push({ type: "game-won", winner: game.winner, state });
    // The no-trump path has no hand/inventory to clear. This is the future
    // executor's game cleanup boundary; score display is retained until NextRound.
    state = freezeData({
      ...state,
      phase: matchWinner ? "resolving" : "game-complete",
    });
    events.push({ type: "game-cleanup", state });
    if (matchWinner) {
      state = freezeData({ ...state, phase: "complete", winner: matchWinner });
      events.push({ type: "match-won", winner: matchWinner, state });
    }
  }
  return freezeData({ state, events });
}
