// @req REQ-2026-024: executable semantics only; production admission belongs to REQ-025.
import { freezeData } from "../immutable";
import type { TableKind, TrumpDefinition } from "../engine/effectTypes";
const table = (
  kind: TableKind,
  remainingCharges?: number,
): TrumpDefinition => ({
  onPlay: [],
  table: {
    pointTarget: null,
    kind,
    ...(remainingCharges === undefined ? {} : { remainingCharges }),
  },
});
export const INTERACTION_TRUMP_DEFINITIONS = freezeData({
  pressure: table("pressure"),
  "pressure-supply": {
    onPlay: [{ type: "grant-trumps", target: "self", count: 1 }],
    table: { pointTarget: null, kind: "pressure" },
  },
  shield: table("shield"),
  "full-shield": table("full-shield"),
  "last-stand": table("last-stand"),
  ceasefire: table("ceasefire"),
  "risk-pledge": table("risk-pledge"),
  "shared-supply": {
    onPlay: [
      { type: "grant-trumps", target: "self", count: 1 },
      { type: "grant-trumps", target: "opponent", count: 1 },
    ],
  },
  "resource-swap": {
    cost: 1,
    onPlay: [{ type: "grant-trumps", target: "self", count: 2 }],
  },
  "purge-hand": {
    cost: "all-other",
    onPlay: [{ type: "grant-trumps", target: "self", count: 3 }],
  },
  harvest: table("harvest", 2),
  bandwagon: table("bandwagon"),
  hush: table("hush"),
  embargo: table("embargo", 1),
  "target-lock": table("target-lock"),
  suppress: table("suppress"),
  "reveal-self": {
    onPlay: [
      { type: "reveal-hidden", target: "self" },
      { type: "grant-trumps", target: "self", count: 1 },
    ],
  },
  decommission: {
    onPlay: [
      { type: "remove-table", target: "self" },
      { type: "grant-trumps", target: "self", count: 1 },
    ],
  },
  "banish-copy": { onPlay: [{ type: "delete-stock", target: "opponent" }] },
  "heavy-hit": table("heavy-hit"),
  "supply-cache": table("supply-cache", 1),
  "life-trade": {
    onPlay: [
      { type: "draw-top", target: "self", count: 1 },
      { type: "grant-trumps", target: "self", count: 2 },
    ],
  },
  "safe-hit": table("safe-hit", 1),
  "sudden-death": { onPlay: [{ type: "sudden-death" }] },
} satisfies Readonly<Record<string, TrumpDefinition>>);
