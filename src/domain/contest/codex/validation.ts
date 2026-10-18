// @req REQ-2026-013: validates only the codex payload, not a save envelope.
import { isTrumpId } from "../trumps/ids";
import type { TrumpId } from "../trumps/ids";
import type { CodexEntry, CodexParseResult } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function parseCodexProgress(input: unknown): CodexParseResult {
  if (!isRecord(input)) return { ok: false, error: "invalid-object" };
  const progress: Partial<Record<TrumpId, CodexEntry>> = {};
  for (const id of Object.keys(input)) {
    if (!isTrumpId(id)) return { ok: false, error: "unknown-card" };
    const entry = input[id];
    if (
      !isRecord(entry) ||
      Object.keys(entry).length !== 2 ||
      !Object.hasOwn(entry, "unlocked") ||
      !Object.hasOwn(entry, "viewed") ||
      typeof entry.unlocked !== "boolean" ||
      typeof entry.viewed !== "boolean" ||
      (entry.viewed && !entry.unlocked)
    ) {
      return { ok: false, error: "invalid-entry" };
    }
    progress[id] = Object.freeze({
      unlocked: entry.unlocked,
      viewed: entry.viewed,
    });
  }
  return { ok: true, progress: Object.freeze(progress) };
}
