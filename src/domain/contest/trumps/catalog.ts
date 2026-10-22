// @req REQ-2026-025: 54 registered identities, 53 admitted executions; no second effect schema.
import { freezeData } from "../immutable";
import { TRUMP_IDS, isTrumpId, type TrumpId } from "./ids";
import { ADMITTED_TRUMP_DEFINITIONS, isAdmittedTrumpId } from "./admitted";
import type { TrumpDefinition, TrumpTag, SourceId } from "./types";

const METADATA = {
  "draw-2": {
    tags: ["buff", "number"],
    provenance: { referenceName: "2 Card", sourceIds: ["W2"] },
  },
  "draw-3": {
    tags: ["buff", "number"],
    provenance: { referenceName: "3 Card", sourceIds: ["W2"] },
  },
  "draw-4": {
    tags: ["buff", "number"],
    provenance: { referenceName: "4 Card", sourceIds: ["W2"] },
  },
  "draw-5": {
    tags: ["buff", "number"],
    provenance: { referenceName: "5 Card", sourceIds: ["W2"] },
  },
  "draw-6": {
    tags: ["buff", "number"],
    provenance: { referenceName: "6 Card", sourceIds: ["W2"] },
  },
  "draw-7": {
    tags: ["buff", "number"],
    provenance: { referenceName: "7 Card", sourceIds: ["W2"] },
  },
  return: {
    tags: ["buff", "number"],
    provenance: { referenceName: "Return", sourceIds: ["G1"] },
  },
  remove: {
    tags: ["debuff", "number"],
    provenance: { referenceName: "Remove", sourceIds: ["G1"] },
  },
  exchange: {
    tags: ["both", "number"],
    provenance: { referenceName: "Exchange", sourceIds: ["G1"] },
  },
  "target-17": {
    tags: ["both", "rule"],
    provenance: { referenceName: "Go for 17", sourceIds: ["G1"] },
  },
  "target-24": {
    tags: ["both", "rule"],
    provenance: { referenceName: "Go for 24", sourceIds: ["G1"] },
  },
  "target-27": {
    tags: ["both", "rule"],
    provenance: { referenceName: "Go for 27", sourceIds: ["G1"] },
  },
  destroy: {
    tags: ["debuff", "counter"],
    provenance: { referenceName: "Destroy", sourceIds: ["G3"] },
  },
  "destroy-all": {
    tags: ["debuff", "counter"],
    provenance: { referenceName: "Destroy+", sourceIds: ["G3"] },
  },
  "best-draw": {
    tags: ["buff", "number"],
    provenance: { referenceName: "Perfect Draw", sourceIds: ["G1"] },
  },
  pressure: {
    tags: ["buff", "score"],
    provenance: { referenceName: "One-Up", sourceIds: ["W2"] },
  },
  "pressure-supply": {
    tags: ["buff", "score", "resource"],
    provenance: { referenceName: "Two-Up", sourceIds: ["W2"] },
  },
  shield: {
    tags: ["buff", "defense", "score"],
    provenance: { referenceName: "Shield", sourceIds: ["G1"] },
  },
  "shared-supply": {
    tags: ["both", "resource"],
    provenance: { referenceName: "Happiness", sourceIds: ["G2"] },
  },
  "resource-swap": {
    tags: ["buff", "resource"],
    provenance: { referenceName: "Trump Switch", sourceIds: ["G2"] },
  },
  harvest: {
    tags: ["buff", "resource"],
    provenance: { referenceName: "Harvest", sourceIds: ["G2"] },
  },
  symbiosis: {
    tags: ["both", "rule"],
    provenance: { referenceName: "symbiosis", sourceIds: ["REQ-021"] },
  },
  "double-hidden": {
    tags: ["debuff", "number"],
    provenance: { referenceName: "double-hidden", sourceIds: ["REQ-021"] },
  },
  bandwagon: {
    tags: ["buff", "resource"],
    provenance: { referenceName: "bandwagon", sourceIds: ["REQ-021"] },
  },
  normalize: {
    tags: ["buff", "counter", "number"],
    provenance: { referenceName: "normalize", sourceIds: ["REQ-021"] },
  },
  hush: {
    tags: ["debuff", "rule"],
    provenance: { referenceName: "hush", sourceIds: ["REQ-021"] },
  },
  embargo: {
    tags: ["debuff", "resource"],
    provenance: { referenceName: "embargo", sourceIds: ["REQ-021"] },
  },
  "full-shield": {
    tags: ["buff", "defense", "score"],
    provenance: { referenceName: "full-shield", sourceIds: ["REQ-021"] },
  },
  "last-stand": {
    tags: ["buff", "score"],
    provenance: { referenceName: "last-stand", sourceIds: ["REQ-021"] },
  },
  ceasefire: {
    tags: ["both", "score"],
    provenance: { referenceName: "ceasefire", sourceIds: ["REQ-021"] },
  },
  "risk-pledge": {
    tags: ["both", "score"],
    provenance: { referenceName: "risk-pledge", sourceIds: ["REQ-021"] },
  },
  "forced-draw": {
    tags: ["debuff", "number"],
    provenance: { referenceName: "forced-draw", sourceIds: ["REQ-021"] },
  },
  redraw: {
    tags: ["buff", "number"],
    provenance: { referenceName: "redraw", sourceIds: ["REQ-021"] },
  },
  scry: {
    tags: ["buff", "number"],
    provenance: { referenceName: "scry", sourceIds: ["REQ-021"] },
  },
  "deck-rotate": {
    tags: ["both", "number"],
    provenance: { referenceName: "deck-rotate", sourceIds: ["REQ-021"] },
  },
  trim: {
    tags: ["buff", "number"],
    provenance: { referenceName: "trim", sourceIds: ["REQ-021"] },
  },
  "reveal-self": {
    tags: ["both", "resource"],
    provenance: { referenceName: "reveal-self", sourceIds: ["REQ-021"] },
  },
  "reveal-opponent": {
    tags: ["debuff", "number"],
    provenance: { referenceName: "reveal-opponent", sourceIds: ["REQ-021"] },
  },
  "target-lock": {
    tags: ["both", "rule"],
    provenance: { referenceName: "target-lock", sourceIds: ["REQ-021"] },
  },
  "table-exchange": {
    tags: ["both", "counter"],
    provenance: { referenceName: "table-exchange", sourceIds: ["REQ-021"] },
  },
  suppress: {
    tags: ["debuff", "counter"],
    provenance: { referenceName: "suppress", sourceIds: ["REQ-021"] },
  },
  decommission: {
    tags: ["buff", "resource"],
    provenance: { referenceName: "decommission", sourceIds: ["REQ-021"] },
  },
  "banish-copy": {
    tags: ["debuff", "resource"],
    provenance: { referenceName: "banish-copy", sourceIds: ["REQ-021"] },
  },
  "heavy-hit": {
    tags: ["debuff", "number"],
    provenance: { referenceName: "heavy-hit", sourceIds: ["REQ-021"] },
  },
  "face-lighten": {
    tags: ["buff", "number"],
    provenance: { referenceName: "face-lighten", sourceIds: ["REQ-021"] },
  },
  "face-burden": {
    tags: ["debuff", "number"],
    provenance: { referenceName: "face-burden", sourceIds: ["REQ-021"] },
  },
  resonance: {
    tags: ["both", "rule"],
    provenance: { referenceName: "resonance", sourceIds: ["REQ-021"] },
  },
  "supply-cache": {
    tags: ["buff", "resource"],
    provenance: { referenceName: "supply-cache", sourceIds: ["REQ-021"] },
  },
  "life-trade": {
    tags: ["both", "resource"],
    provenance: { referenceName: "life-trade", sourceIds: ["REQ-021"] },
  },
  "purge-hand": {
    tags: ["buff", "resource"],
    provenance: { referenceName: "purge-hand", sourceIds: ["REQ-021"] },
  },
  "safe-hit": {
    tags: ["buff", "defense"],
    provenance: { referenceName: "safe-hit", sourceIds: ["REQ-021"] },
  },
  regret: {
    tags: ["both", "counter"],
    provenance: { referenceName: "regret", sourceIds: ["REQ-022"] },
  },
  "skill-revival": {
    tags: ["buff", "resource"],
    provenance: { referenceName: "skill-revival", sourceIds: ["REQ-022"] },
  },
  "sudden-death": {
    tags: ["both", "rule"],
    provenance: { referenceName: "sudden-death", sourceIds: ["REQ-022"] },
  },
} as const satisfies Record<
  TrumpId,
  {
    readonly tags: readonly TrumpTag[];
    readonly provenance: {
      readonly referenceName: string;
      readonly sourceIds: readonly SourceId[];
    };
  }
>;

export const TRUMP_CATALOG: Readonly<Record<TrumpId, TrumpDefinition>> =
  freezeData(
    Object.fromEntries(
      TRUMP_IDS.map((id): [TrumpId, TrumpDefinition] => [
        id,
        {
          id,
          nameKey: `contest.trump.${id}.name`,
          descriptionKey: `contest.trump.${id}.description`,
          ...METADATA[id],
          admission: isAdmittedTrumpId(id) ? "admitted" : "pending-skill",
          playable: isAdmittedTrumpId(id),
          execution: isAdmittedTrumpId(id)
            ? ADMITTED_TRUMP_DEFINITIONS[id]
            : null,
        } satisfies TrumpDefinition,
      ]),
    ) as Record<TrumpId, TrumpDefinition>,
  );
export function findTrump(value: unknown): TrumpDefinition | undefined {
  return isTrumpId(value) ? TRUMP_CATALOG[value] : undefined;
}
