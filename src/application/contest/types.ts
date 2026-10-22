// @req REQ-2026-017/020: public coordination ports contain projected data only.
import type {
  MatchCommand,
  MatchEventView,
  MatchObservation,
  ContestRandom,
  PlayTrumpCommand,
} from "../../domain/contest/engine";

import type {
  BaselineAction,
  BaselinePolicy,
} from "../../domain/contest/ai/policy";

// @req REQ-2026-025: a target/cost choice expires on commit, pause, skip, restart or exit.
export type ContestTrumpAction = Omit<PlayTrumpCommand, "player"> & {
  readonly inputId: number;
};
export type ContestInput = ContestAction | ContestTrumpAction;
export type ContestAction = Exclude<MatchCommand["type"], "PlayTrump">;
// The adapter exposes only the domain baseline contract, with no deal RNG port.
export type OpponentAction = BaselineAction;
export type OpponentPolicy = BaselinePolicy;
export interface ContestView {
  readonly match: MatchObservation | null;
  readonly busy: boolean;
  readonly thinking: boolean;
  readonly paused: boolean;
  readonly event: MatchEventView | null;
  readonly effectId: number;
  readonly trumpCommands: readonly ContestTrumpAction[];
  readonly actions: readonly MatchCommand["type"][];
}
export interface ContestControllerOptions {
  readonly random?: ContestRandom;
  /** REQ-026 opts in when the page has a usable trump interface. */
  readonly preset?: "standard-no-trumps" | "s2-development";
  readonly opponent?: OpponentPolicy;
  readonly reducedMotion?: boolean;
  readonly onEvent?: (event: MatchEventView) => void;
}
