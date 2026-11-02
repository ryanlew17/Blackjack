// @req REQ-2026-027: public skill and reaction inputs carry the current application generation.
// @req REQ-2026-017/020: public coordination ports contain projected data only.
import type {
  MatchCommand,
  MatchEventView,
  MatchObservation,
  ContestRandom,
  PlayTrumpCommand,
  ActivateSkillCommand,
  PassReactionCommand,
} from "../../domain/contest/engine";

import type {
  SkillId,
  SkillTextKey,
} from "../../domain/contest/skills/catalog";

import type {
  BaselineAction,
  BaselinePolicy,
} from "../../domain/contest/ai/policy";

// @req REQ-2026-025: a target/cost choice expires on commit, pause, skip, restart or exit.
export type ContestTrumpAction = Omit<PlayTrumpCommand, "player"> & {
  readonly inputId: number;
};
export type ContestSkillAction = Omit<ActivateSkillCommand, "player"> & {
  readonly inputId: number;
};
export type ContestPassAction = Omit<PassReactionCommand, "player"> & {
  readonly inputId: number;
};
export type ContestInput =
  ContestAction | ContestTrumpAction | ContestSkillAction | ContestPassAction;
export type ContestAction = Exclude<
  MatchCommand["type"],
  "PlayTrump" | "ActivateSkill" | "ResolveForcedTurn" | "PassReaction"
>;
// The adapter exposes only the domain baseline contract, with no deal RNG port.
export type OpponentAction = BaselineAction;
export type OpponentPolicy = BaselinePolicy;
/** Only the human's authorized decision; both choices carry the current cancellation generation. */
export interface ContestReaction {
  readonly activate: ActivateSkillCommand & { readonly inputId: number };
  readonly pass: PassReactionCommand & { readonly inputId: number };
}
export interface ContestView {
  readonly match: MatchObservation | null;
  readonly busy: boolean;
  readonly thinking: boolean;
  readonly paused: boolean;
  readonly event: MatchEventView | null;
  readonly effectId: number;
  // @req REQ-2026-026: bounded, authorized feedback survives the last replay frame.
  readonly inputId: number;
  readonly recentEvents: readonly MatchEventView[];
  readonly trumpCommands: readonly ContestTrumpAction[];
  readonly skillCommands: readonly ContestSkillAction[];
  readonly reaction: ContestReaction | null;
  readonly actions: readonly MatchCommand["type"][];
}
export interface ContestControllerOptions {
  readonly random?: ContestRandom;
  /** Require a skill choice before creating a standard S2 match. */
  readonly prepareSkills?: boolean;
  /** REQ-026 opts in when the page has a usable trump interface. */
  readonly preset?: "standard-no-trumps" | "s2-development";
  readonly opponent?: OpponentPolicy;
  readonly reducedMotion?: boolean;
  readonly onEvent?: (event: MatchEventView) => void;
}

// @req REQ-2026-027: independent pre-match store; no Match or opponent choice exists yet.
export interface ContestPreparation {
  readonly inputId: number;
  readonly difficulty: "standard";
  readonly paused: boolean;
  readonly selected: SkillId | null;
  readonly options: readonly {
    readonly id: SkillId;
    readonly nameKey: SkillTextKey;
    readonly descriptionKey: SkillTextKey;
    readonly initialUses: number;
  }[];
}
