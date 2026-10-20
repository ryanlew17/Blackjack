// @req REQ-2026-016: scoring is internal; match phases consume each round once.
import type { PlayerId } from "../types";
import type { ContestGameState, MatchRules } from "./types";

export function createContestGame(
  number: number,
  rules: MatchRules,
): ContestGameState {
  return {
    number,
    points: { human: 0, ai: 0 },
    target: rules.initialGameTarget,
    roundsPlayed: 0,
    winner: null,
  };
}

export function scoreContestRound(
  game: ContestGameState,
  winner: PlayerId | null,
  rules: MatchRules,
): ContestGameState {
  const points = {
    human: game.points.human + (winner === "human" ? 1 : 0),
    ai: game.points.ai + (winner === "ai" ? 1 : 0),
  };
  const target =
    points.human === game.target - 1 && points.ai === game.target - 1
      ? game.target + rules.targetIncrement
      : game.target;
  return {
    ...game,
    points,
    target,
    roundsPlayed: game.roundsPlayed + 1,
    winner:
      points.human >= target ? "human" : points.ai >= target ? "ai" : null,
  };
}
