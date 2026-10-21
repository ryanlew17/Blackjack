// @req REQ-2026-023: executed definitions, not production admission or the candidate codex.
import { freezeData } from "../immutable";
import type { TrumpDefinition } from "../engine/effectTypes";
export const NUMBER_TRUMP_DEFINITIONS = freezeData({
  "draw-2": { onPlay: [{ type: "draw-number", value: 2 }] },
  "draw-3": { onPlay: [{ type: "draw-number", value: 3 }] },
  "draw-4": { onPlay: [{ type: "draw-number", value: 4 }] },
  "draw-5": { onPlay: [{ type: "draw-number", value: 5 }] },
  "draw-6": { onPlay: [{ type: "draw-number", value: 6 }] },
  "draw-7": { onPlay: [{ type: "draw-number", value: 7 }] },
  return: { onPlay: [{ type: "return-last" }] },
  remove: { onPlay: [{ type: "return-last", target: "opponent" }] },
  exchange: { onPlay: [{ type: "swap-last" }] },
  "target-17": { onPlay: [], table: { pointTarget: 17 } },
  "target-24": { onPlay: [], table: { pointTarget: 24 } },
  "target-27": { onPlay: [], table: { pointTarget: 27 } },
  destroy: { onPlay: [{ type: "remove-latest", target: "opponent" }] },
  "destroy-all": { onPlay: [{ type: "remove-all", target: "opponent" }] },
  "best-draw": { onPlay: [{ type: "draw-best" }] },
  symbiosis: { onPlay: [], table: { pointTarget: null, kind: "symbiosis" } },
  "double-hidden": {
    onPlay: [{ type: "hidden-multiplier", target: "opponent", value: 2 }],
  },
  normalize: {
    onPlay: [{ type: "hidden-multiplier", target: "self", value: 1 }],
  },
  "forced-draw": {
    onPlay: [{ type: "draw-top", target: "opponent", count: 1 }],
  },
  redraw: {
    onPlay: [
      { type: "return-last" },
      { type: "draw-top", target: "self", count: 1 },
    ],
  },
  scry: { onPlay: [{ type: "scry", count: 2 }] },
  "deck-rotate": { onPlay: [{ type: "rotate-deck" }] },
  trim: { onPlay: [{ type: "trim" }] },
  "reveal-opponent": {
    onPlay: [{ type: "reveal-hidden", target: "opponent" }],
  },
  "table-exchange": { onPlay: [{ type: "exchange-table" }] },
  "face-lighten": {
    onPlay: [],
    table: { pointTarget: null, kind: "face-lighten" },
  },
  "face-burden": {
    onPlay: [],
    table: { pointTarget: null, kind: "face-burden" },
  },
  resonance: { onPlay: [], table: { pointTarget: null, kind: "resonance" } },
  regret: { onPlay: [{ type: "undo-last" }] },
} satisfies Readonly<Record<string, TrumpDefinition>>);
