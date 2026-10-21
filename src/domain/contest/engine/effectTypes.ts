// @req REQ-2026-019/022/023: card bodies, audit and independent effect records.
import type { NumberValue, PlayerId } from "../types";
import type { TrumpResourceRules } from "./resourceTypes";
export type Side = "self" | "opponent";
export type TableKind =
  "symbiosis" | "resonance" | "face-lighten" | "face-burden";
export interface TableSpecification {
  readonly pointTarget: number | null;
  readonly kind?: TableKind;
  readonly remainingCharges?: number;
}
export type TrumpEffect =
  | { readonly type: "draw-number"; readonly value: NumberValue }
  | { readonly type: "draw-top"; readonly target: Side; readonly count: number }
  | { readonly type: "draw-best" }
  | { readonly type: "return-last"; readonly target?: Side }
  | { readonly type: "swap-last" }
  | { readonly type: "remove-table"; readonly target: Side }
  | { readonly type: "remove-latest" | "remove-all"; readonly target: Side }
  | {
      readonly type: "grant-trumps";
      readonly target: Side;
      readonly count: number;
      readonly definitionId?: string;
    }
  | { readonly type: "generate-trump"; readonly definitionId: string }
  | { readonly type: "generate-number"; readonly value: NumberValue }
  | { readonly type: "delete-last-number"; readonly target: Side }
  | {
      readonly type: "hidden-multiplier";
      readonly target: Side;
      readonly value: 1 | 2;
    }
  | { readonly type: "reveal-hidden"; readonly target: Side }
  | { readonly type: "scry"; readonly count: 2 }
  | { readonly type: "rotate-deck" | "trim" | "exchange-table" | "undo-last" };
export interface TrumpDefinition {
  readonly onPlay: readonly TrumpEffect[];
  readonly cost?: number;
  readonly table?: TableSpecification;
}
export interface TrumpRules {
  readonly tableCapacity: 5;
  readonly definitions: Readonly<Record<string, TrumpDefinition>>;
  readonly resources?: TrumpResourceRules;
}
export interface TrumpSeed {
  readonly instanceId: string;
  readonly definitionId: string;
}
export type TrumpOrigin =
  | {
      readonly type: "stock" | "fixture";
      readonly owner: PlayerId;
      readonly game: number;
    }
  | { readonly type: "generated"; readonly sourceId: string };
export interface TrumpInstance extends TrumpSeed {
  readonly origin: TrumpOrigin;
}
export type TrumpSetup = Readonly<Record<PlayerId, readonly TrumpSeed[]>>;
export interface TableEffect {
  readonly effectId: string;
  readonly sourceInstanceId: string;
  readonly definitionId: string;
  readonly owner: PlayerId;
  readonly pointTarget: number | null;
  readonly kind?: TableKind;
  readonly cardId?: string;
  readonly adjustment?: -2 | 2;
  readonly remainingCharges?: number;
  /** REQ-024 can suspend a record without discarding it or rerunning onPlay. */
  readonly suppressed?: boolean;
}
export interface TrumpDestruction {
  readonly instance: TrumpInstance;
  readonly owner: PlayerId;
  readonly reason: "played" | "cost" | "deleted";
  readonly public: boolean;
}
export interface TrumpState {
  readonly game: number;
  readonly hands: Readonly<Record<PlayerId, readonly TrumpInstance[]>>;
  readonly stock: Readonly<Record<PlayerId, readonly TrumpInstance[]>>;
  readonly table: readonly TableEffect[];
  readonly destroyed: readonly TrumpDestruction[];
  readonly nextGeneratedId: number;
  readonly nextEffectId: number;
}
export interface TrumpObservation {
  readonly ownHand: readonly TrumpInstance[];
  readonly opponentHandCount: number;
  readonly stockCounts: Readonly<Record<PlayerId, number>>;
  readonly table: readonly TableEffect[];
  readonly destroyed: readonly {
    readonly owner: PlayerId;
    readonly reason: TrumpDestruction["reason"];
    readonly instance: TrumpInstance | null;
  }[];
}
export interface PlayTrumpCommand {
  readonly type: "PlayTrump";
  readonly player: PlayerId;
  readonly instanceId: string;
  readonly targetId?: string;
  readonly ownTargetId?: string;
  readonly costIds?: readonly string[];
}
export interface TrumpEventPayload {
  readonly type: "trump";
  readonly player: PlayerId;
  readonly instance: TrumpInstance;
  readonly effect:
    | "played"
    | "draw"
    | "return"
    | "placed"
    | "removed"
    | "generated-number"
    | "deleted-number"
    | "swapped"
    | "modified"
    | "revealed"
    | "peek"
    | "rotated"
    | "exchanged"
    | "undone";
  readonly card?: NumberValue | null;
  readonly targetId?: string;
  /** Only the actor receives these values; never spread this payload into a view. */
  readonly privateCards?: readonly NumberValue[];
}
export type ResourceCause =
  "game-start" | "round-start" | "hit" | "effect" | "cost";
export interface ResourceEventPayload {
  readonly type: "resource";
  readonly player: PlayerId;
  readonly operation: "draw" | "generate" | "delete" | "transfer";
  readonly cause: ResourceCause;
  readonly instance: TrumpInstance | null;
  readonly fromPlayer?: PlayerId;
  readonly public: boolean;
}
export type ResourceEventView = Omit<ResourceEventPayload, "public">;
export interface SkillUseRecovery {
  readonly uses: 1;
  readonly additionalGameActivations: 1;
}
export interface SuddenDeathMarker {
  readonly player: PlayerId;
  readonly sourceInstanceId: string;
}
