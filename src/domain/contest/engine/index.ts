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
