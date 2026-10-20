// @req REQ-2026-017/020: public coordination ports contain projected data only.
import type {
  MatchCommand,
  MatchEventView,
  MatchObservation,
  RandomSource,
} from "../../domain/contest/engine";

import type {
  BaselineAction,
  BaselinePolicy,
} from "../../domain/contest/ai/policy";

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
  readonly actions: readonly MatchCommand["type"][];
}
export interface ContestControllerOptions {
  readonly random?: RandomSource;
  readonly opponent?: OpponentPolicy;
  readonly reducedMotion?: boolean;
  readonly onEvent?: (event: MatchEventView) => void;
}
