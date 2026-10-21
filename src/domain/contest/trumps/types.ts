// @req REQ-2026-013: descriptions of effects, not an effect executor.
import type { Difficulty, NumberValue, PlayerId } from "../types";
import type { TrumpId } from "./ids";
export type TrumpTag =
  | "buff"
  | "debuff"
  | "both"
  | "number"
  | "rule"
  | "score"
  | "resource"
  | "counter"
  | "defense";
export type Side = "self" | "opponent";
export type SourceId = "W1" | "W2" | "W3" | "G1" | "G2" | "G3";
export type TrumpTextKey = `contest.trump.${TrumpId}.${"name" | "description"}`;
export type ImmediateEffect =
  | { readonly kind: "drawNumber"; readonly value: NumberValue }
  | { readonly kind: "returnLastFaceUp"; readonly target: Side }
  | { readonly kind: "swapLastFaceUp" }
  | {
      readonly kind: "removeTable";
      readonly target: Side;
      readonly scope: "latest" | "all";
    }
  | {
      readonly kind: "drawBest";
      readonly algorithm: "highest-safe-else-lowest";
    }
  | {
      readonly kind: "grantTrump";
      readonly target: Side;
      readonly count: number;
    };
export type OngoingEffect =
  | { readonly kind: "pointTarget"; readonly value: 17 | 24 | 27 }
  | { readonly kind: "winBonus"; readonly amount: number }
  | { readonly kind: "cancelOpponentBonusOnLoss"; readonly amount: number }
  | {
      readonly kind: "grantAfterOtherTrumpConsumed";
      readonly count: number;
      readonly charges: number;
      readonly excludeSelf: true;
      readonly grantDoesNotTrigger: true;
      readonly leaveOnExhaustion: true;
    };
export type PublicCondition =
  | { readonly kind: "hasFaceUp"; readonly target: Side }
  | { readonly kind: "hasTableCard"; readonly target: Side }
  | { readonly kind: "hasOtherHandCards"; readonly count: number };
export interface TrumpDefinition {
  readonly id: TrumpId;
  readonly nameKey: TrumpTextKey;
  readonly descriptionKey: TrumpTextKey;
  readonly tags: readonly TrumpTag[];
  readonly conditions: readonly PublicCondition[];
  readonly cost: {
    readonly discardOtherHandCards: number;
    readonly selection: "owner-choice";
  } | null;
  readonly onPlay: readonly ImmediateEffect[];
  readonly table: {
    readonly effects: readonly OngoingEffect[];
    readonly expires: "round-end";
    readonly stacking:
      "additive" | "independent" | "replace-global-point-target";
  } | null;
  readonly failedResolution: "consume";
  readonly provenance: {
    readonly referenceName: string;
    readonly sourceIds: readonly SourceId[];
  };
  readonly admission: "priority-prototype" | "extended-experiment";
  readonly playable: false; // No candidate has passed S2 admission yet.
}
export interface CandidateAvailability {
  readonly copiesPerSide: Readonly<Record<Difficulty, number>>;
}
export type TrumpInstance = {
  readonly instanceId: string;
  readonly definitionId: TrumpId;
  readonly owner: PlayerId;
} & (
  | { readonly zone: "pool" | "hand" }
  | {
      readonly zone: "table";
      readonly placedSequence: number;
      readonly remainingCharges: number | null;
    }
  | { readonly zone: "discard"; readonly identityWasPublic: boolean }
);
