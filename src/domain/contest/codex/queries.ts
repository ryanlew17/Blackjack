// @req REQ-2026-013/025: stable catalog order; locked entries omit card metadata.
import { STOCK_QUANTITIES } from "../presets/resources";
import { DIFFICULTIES } from "../types";
import { freezeData } from "../immutable";
import { TRUMP_CATALOG } from "../trumps/catalog";
import { TRUMP_IDS, type TrumpId } from "../trumps/ids";
import type { CandidateAvailability, TrumpDefinition } from "../trumps/types";
import type { CodexProgress } from "./types";
export type CodexItem =
  | { readonly id: TrumpId; readonly status: "locked" }
  | {
      readonly id: TrumpId;
      readonly status: "new" | "viewed";
      readonly definition: TrumpDefinition;
      readonly availability: CandidateAvailability;
    };

export function listCodexItems(progress: CodexProgress): readonly CodexItem[] {
  return TRUMP_IDS.map((id) => {
    const entry = progress[id];
    if (!entry?.unlocked) return { id, status: "locked" };
    return {
      id,
      status: entry.viewed ? "viewed" : "new",
      definition: TRUMP_CATALOG[id],
      availability: freezeData({
        copiesPerSide: Object.fromEntries(
          DIFFICULTIES.map((d, i) => [d, STOCK_QUANTITIES[id][i]]),
        ) as CandidateAvailability["copiesPerSide"],
      }),
    };
  });
}

export function listUnlockedIds(progress: CodexProgress): readonly TrumpId[] {
  return TRUMP_IDS.filter((id) => progress[id]?.unlocked);
}

export function firstUnviewedId(progress: CodexProgress): TrumpId | undefined {
  return TRUMP_IDS.find(
    (id) => progress[id]?.unlocked && !progress[id]?.viewed,
  );
}

export function codexSummary(progress: CodexProgress) {
  const unlocked = listUnlockedIds(progress);
  return {
    total: TRUMP_IDS.length,
    unlocked: unlocked.length,
    unviewed: unlocked.filter((id) => !progress[id]?.viewed).length,
  };
}
