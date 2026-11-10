// @req REQ-2026-027/029: authoritative skill state and authorized view are distinct contracts.
import type { SkillId } from "../skills/catalog";
import type { Difficulty, PlayerId, NumberValue } from "../types";

export interface SkillRules {
  readonly difficulty: Difficulty;
  readonly playableDifficulties: readonly Difficulty[];
  readonly selected: Readonly<Record<PlayerId, SkillId>>;
}
export type SkillActivationStatus =
  "prepared" | "succeeded" | "ineffective" | "cancelled" | "expired";
export type SkillPendingEffect =
  | {
      readonly type: "tempt-fate" | "frame" | "metamorphosis" | "soul-transfer";
    }
  | {
      readonly type: "provoke";
      readonly targetTurn: number;
      readonly phase: "waiting" | "watching" | "penalty";
    }
  | {
      readonly type: "mind-grip" | "twin-bloom" | "endless-life";
      readonly targetTurn: number;
    };
export interface SkillActivation {
  /** Private ability order shared with Turn-start trumps; never expose gaps in this counter. */
  readonly sequence: number;
  readonly roundNumber: number;
  readonly turnNumber: number;
  readonly status: SkillActivationStatus;
  readonly public: boolean;
  readonly effect?: SkillPendingEffect;
}
export interface PlayerSkillState {
  /** Match history survives Game record cleanup; a preparation or miss never sets it. */
  readonly hasSucceeded?: true;
  readonly disabled?: true;
  readonly remainingUses: number;
  /** Publicly known upper bound persists across Games; secret spending must not change it. */
  readonly publicRemainingUses: number;
  readonly gameActivationsRemaining: number;
  readonly activations: readonly SkillActivation[];
}
export interface SkillState {
  /** Public stock/new-activation seal, inclusive through this global Round number. */
  readonly seal?: { readonly throughRound: number };
  readonly players: Readonly<Record<PlayerId, PlayerSkillState>>;
  readonly nextActivationSequence: number;
  /** Viewer -> authorized opposing logical hidden-slot instance, only in this Round. */
  readonly knownHiddenCards: Readonly<Record<PlayerId, string | null>>;
}
export interface SkillView {
  /** Public ongoing Nullify seal/disable, authorized in the same frame as the opposing lock. */
  readonly effectActive?: true;
  readonly disabled?: true;
  /** Authorized only to the owner, independent of the public seal or disable. */
  readonly canRecover?: true;
  readonly id: SkillId;
  readonly initialUses: number;
  /** Public upper bound, including for the owner; secret spending never changes it. */
  readonly publicRemainingUses: number;
  readonly remainingUses: number | null;
  readonly knownRemainingUses: { readonly min: number; readonly max: number };
  readonly gameActivationsRemaining: number | null;
  readonly activations: readonly Omit<SkillActivation, "sequence" | "public">[];
}
export type SkillObservation = Readonly<Record<PlayerId, SkillView>>;
export interface ActivateSkillCommand {
  readonly type: "ActivateSkill";
  readonly player: PlayerId;
  readonly skillId: SkillId;
  /** Reusing a command from a previous Turn must not activate on a later Turn. */
  readonly turnNumber: number;
  /** Required only for Twin Bloom; a passed or older complete-command boundary is stale. */
  readonly reactionBoundary?: number;
}
/** Internal atomic continuation, never a normal player decision. */
export interface ResolveForcedTurnCommand {
  readonly type: "ResolveForcedTurn";
  readonly player: PlayerId;
  readonly turnNumber: number;
}
export interface SkillEventPayload {
  readonly type: "skill";
  readonly player: PlayerId;
  readonly skillId: SkillId;
  readonly status: SkillActivationStatus;
  readonly public: boolean;
  /** Public face-up changes only; never a Spirit Sight private value. */
  readonly card?: NumberValue;
  readonly targetId?: string;
  /** Signed settlement adjustment after both hidden slots have been publicly revealed. */
  readonly amount?: number;
}
export type SkillEventView = Omit<SkillEventPayload, "public">;
