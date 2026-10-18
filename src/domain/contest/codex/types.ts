// @req REQ-2026-013: progress is definition-based, never instance-based.
import type { TrumpId } from "../trumps/ids";
export interface CodexEntry {
  readonly unlocked: boolean;
  readonly viewed: boolean;
}
export type CodexProgress = Readonly<Partial<Record<TrumpId, CodexEntry>>>;
// Hidden encounters deliberately carry no card identity.
export type CodexObservation =
  | {
      readonly kind: "self-received" | "opponent-revealed";
      readonly cardId: unknown;
    }
  | { readonly kind: "opponent-hidden" };
export type CodexMode = "standard" | "custom";
export type CodexUpdate =
  | {
      readonly ok: true;
      readonly progress: CodexProgress;
      readonly newlyUnlocked: readonly TrumpId[];
    }
  | { readonly ok: false; readonly error: "unknown-card" };
export type CodexParseResult =
  | { readonly ok: true; readonly progress: CodexProgress }
  | {
      readonly ok: false;
      readonly error: "invalid-object" | "unknown-card" | "invalid-entry";
    };
