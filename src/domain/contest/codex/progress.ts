// @req REQ-2026-013: pure data updates; callers submit progress before animations.
import { isTrumpId } from "../trumps/ids";
import type {
  CodexMode,
  CodexObservation,
  CodexProgress,
  CodexUpdate,
} from "./types";

export function createCodexProgress(): CodexProgress {
  return Object.freeze({});
}

export function recordEncounter(
  progress: CodexProgress,
  mode: CodexMode,
  observation: CodexObservation,
): CodexUpdate {
  if (mode === "custom" || observation.kind === "opponent-hidden") {
    return { ok: true, progress, newlyUnlocked: [] };
  }
  const id = observation.cardId;
  if (!isTrumpId(id)) return { ok: false, error: "unknown-card" };
  if (progress[id]?.unlocked) return { ok: true, progress, newlyUnlocked: [] };
  return {
    ok: true,
    progress: Object.freeze({
      ...progress,
      [id]: Object.freeze({ unlocked: true, viewed: false }),
    }),
    newlyUnlocked: Object.freeze([id]),
  };
}

export function markViewed(
  progress: CodexProgress,
  cardId: unknown,
): CodexUpdate {
  if (!isTrumpId(cardId)) return { ok: false, error: "unknown-card" };
  const entry = progress[cardId];
  if (!entry?.unlocked || entry.viewed)
    return { ok: true, progress, newlyUnlocked: [] };
  return {
    ok: true,
    progress: Object.freeze({
      ...progress,
      [cardId]: Object.freeze({ unlocked: true, viewed: true }),
    }),
    newlyUnlocked: [],
  };
}
