// @req REQ-2026-019: isolated, explicit test definitions; never export from index.
import { freezeData } from "../immutable";
import type { RoundRules } from "./types";
import type { TrumpSetup } from "./effectTypes";
export const PROTOTYPE_RULES: RoundRules = freezeData({
  version: 1,
  pointTarget: 21,
  trumps: {
    tableCapacity: 5,
    definitions: {
      "test-draw-2": { onPlay: [{ type: "draw-number", value: 2 }] },
      "test-return": { onPlay: [{ type: "return-last" }] },
      "test-target-17": { onPlay: [], table: { pointTarget: 17 } },
      "test-target-24": { onPlay: [], table: { pointTarget: 24 } },
      "test-dispel": { onPlay: [{ type: "remove-table", target: "opponent" }] },
      "test-mixed": {
        onPlay: [{ type: "draw-number", value: 3 }],
        table: { pointTarget: 24 },
      },
      "test-marker": { onPlay: [], table: { pointTarget: null } },
    },
  },
});
/** Fixed per-Game inventory only; no drop chances, supply pool or catalog admission. */
export function prototypeSetup(
  human: readonly string[],
  ai: readonly string[] = [],
): TrumpSetup {
  return freezeData({
    human: human.map((definitionId, i) => ({
      instanceId: `human-${i}`,
      definitionId,
    })),
    ai: ai.map((definitionId, i) => ({ instanceId: `ai-${i}`, definitionId })),
  });
}
