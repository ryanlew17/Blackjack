// @req REQ-2026-025: display metadata references the one executable definition.
import type { Difficulty } from "../types";
import type { TrumpDefinition as Execution } from "../engine/effectTypes";
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
export type SourceId =
  "W1" | "W2" | "W3" | "G1" | "G2" | "G3" | "REQ-021" | "REQ-022";
export type TrumpTextKey = `contest.trump.${TrumpId}.${"name" | "description"}`;
export interface TrumpDefinition {
  readonly id: TrumpId;
  readonly nameKey: TrumpTextKey;
  readonly descriptionKey: TrumpTextKey;
  readonly tags: readonly TrumpTag[];
  readonly provenance: {
    readonly referenceName: string;
    readonly sourceIds: readonly SourceId[];
  };
  readonly admission: "admitted" | "pending-skill";
  readonly playable: boolean;
  /** Null only for REQ-027's registered, unimplemented Skill Revival. */
  readonly execution: Execution | null;
}
export interface CandidateAvailability {
  readonly copiesPerSide: Readonly<Record<Difficulty, number>>;
}
