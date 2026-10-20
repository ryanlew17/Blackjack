// @req REQ-2026-019: minimal effect vocabulary; no catalog or resource policy admission.
import type { NumberValue, PlayerId } from "../types";
export type TrumpEffect =
  | { readonly type: "draw-number"; readonly value: NumberValue }
  | { readonly type: "return-last" }
  | { readonly type: "remove-table"; readonly target: "opponent" };
export interface TrumpDefinition {
  readonly onPlay: readonly TrumpEffect[];
  /** null is a capacity-only fixture marker, not a production effect. */
  readonly table?: { readonly pointTarget: number | null };
}
export interface TrumpRules {
  readonly tableCapacity: 5;
  readonly definitions: Readonly<Record<string, TrumpDefinition>>;
}
export interface TrumpInstance {
  readonly instanceId: string;
  readonly definitionId: string;
}
export type TrumpSetup = Readonly<Record<PlayerId, readonly TrumpInstance[]>>;
export interface PlacedTrump extends TrumpInstance {
  readonly owner: PlayerId;
  readonly pointTarget: number | null;
}
export interface TrumpState {
  readonly hands: TrumpSetup;
  readonly table: readonly PlacedTrump[];
  readonly discarded: readonly TrumpInstance[];
}
export interface TrumpObservation {
  readonly ownHand: readonly TrumpInstance[];
  readonly opponentHandCount: number;
  readonly table: readonly PlacedTrump[];
  readonly discarded: readonly TrumpInstance[];
}
export interface PlayTrumpCommand {
  readonly type: "PlayTrump";
  readonly player: PlayerId;
  readonly instanceId: string;
  readonly targetId?: string;
}
export interface TrumpEventPayload {
  readonly type: "trump";
  readonly player: PlayerId;
  readonly instance: TrumpInstance;
  readonly effect: "played" | "draw" | "return" | "placed" | "removed";
  readonly card?: NumberValue | null;
  readonly targetId?: string;
}
