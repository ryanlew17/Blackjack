// @req REQ-2026-015: authority API; consumers beyond coordination use views only.
export { createRound, transition } from "./transition";
export { legalActions } from "./legalActions";
export {
  observeRound,
  projectRoundEvent,
  projectRoundTransition,
} from "./observation";
export { DEFAULT_ROUND_RULES, snapshotRoundRules } from "./rules";
export type { RandomSource } from "./numbers";
export type {
  RoundRules,
  TurnState,
  RoundResult,
  RoundPhase,
  RoundState,
  RoundCommand,
  RoundEvent,
  RoundTransition,
  NumberCardView,
  RoundHandView,
  RoundObservation,
  RoundEventView,
  RoundTransitionView,
} from "./types";

// @req REQ-2026-016
export { createMatch, transitionMatch, legalMatchActions } from "./match";
export {
  observeMatch,
  projectMatchEvent,
  projectMatchTransition,
} from "./matchObservation";
export type {
  PlayerScores,
  MatchRules,
  ContestGameState,
  MatchPhase,
  MatchState,
  MatchCommand,
  MatchEvent,
  MatchTransition,
  MatchObservation,
  MatchEventView,
  MatchTransitionView,
} from "./types";

// @req REQ-2026-019: generic effects only; fixed prototype definitions stay isolated.
export { legalTrumpCommands } from "./effects";
export type {
  PlayTrumpCommand,
  TrumpEffect,
  TrumpDefinition,
  TrumpRules,
  TrumpInstance,
  TrumpSetup,
  TrumpState,
  TrumpObservation,
} from "./effectTypes";
