// @req REQ-2026-013: data-layer entry point, no browser or gameplay dependencies.
export { createCodexProgress, recordEncounter, markViewed } from "./progress";
export { parseCodexProgress } from "./validation";
export {
  listCodexItems,
  listUnlockedIds,
  firstUnviewedId,
  codexSummary,
} from "./queries";
export type { CodexItem } from "./queries";
export type {
  CodexEntry,
  CodexProgress,
  CodexObservation,
  CodexMode,
  CodexUpdate,
  CodexParseResult,
} from "./types";
