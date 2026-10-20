// @req REQ-2026-017: public coordination ports contain projected data only.
import type {
  MatchCommand,
  MatchEventView,
  MatchObservation,
  RandomSource,
} from "../../domain/contest/engine";

export type ContestAction = MatchCommand["type"];
export type OpponentAction = Extract<ContestAction, "Hit" | "Stay">;
export type OpponentPolicy = (
  observation: MatchObservation,
  actions: readonly OpponentAction[],
) => OpponentAction;
export interface ContestView {
  readonly match: MatchObservation | null;
  readonly busy: boolean;
  readonly thinking: boolean;
  readonly paused: boolean;
  readonly event: MatchEventView | null;
  readonly effectId: number;
  readonly actions: readonly ContestAction[];
}
export interface ContestControllerOptions {
  readonly random?: RandomSource;
  readonly opponent?: OpponentPolicy;
  readonly reducedMotion?: boolean;
  readonly onEvent?: (event: MatchEventView) => void;
}
