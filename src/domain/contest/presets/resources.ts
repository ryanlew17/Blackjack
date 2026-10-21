// @req REQ-2026-022: quantities are resource configuration, not effect admission.
import { freezeData } from "../immutable";
import { DIFFICULTIES } from "../types";
import type { Difficulty } from "../types";
import { HIT_PROBABILITIES } from "../engine/resourceTypes";
import type { TrumpResourceRules } from "../engine/resourceTypes";

export const STOCK_QUANTITIES = freezeData({
  "draw-2": [2, 2, 2, 2, 2],
  "draw-3": [2, 2, 2, 2, 2],
  "draw-4": [2, 2, 2, 2, 2],
  "draw-5": [2, 2, 2, 2, 2],
  "draw-6": [2, 2, 2, 2, 2],
  "draw-7": [2, 2, 2, 2, 2],
  return: [3, 4, 4, 5, 5],
  remove: [1, 2, 2, 2, 2],
  exchange: [1, 1, 2, 2, 2],
  "target-17": [0, 1, 1, 1, 1],
  "target-24": [1, 1, 1, 1, 1],
  "target-27": [0, 0, 1, 1, 1],
  destroy: [2, 3, 3, 3, 3],
  "destroy-all": [0, 1, 1, 1, 1],
  "best-draw": [0, 1, 1, 1, 1],
  pressure: [1, 2, 2, 2, 2],
  "pressure-supply": [0, 1, 1, 1, 1],
  shield: [2, 2, 3, 3, 3],
  "shared-supply": [1, 1, 1, 1, 1],
  "resource-swap": [1, 1, 1, 1, 1],
  harvest: [0, 1, 1, 1, 1],
  symbiosis: [0, 0, 1, 1, 1],
  "double-hidden": [0, 1, 1, 1, 1],
  bandwagon: [1, 1, 1, 1, 1],
  normalize: [1, 2, 2, 2, 2],
  hush: [0, 1, 1, 1, 1],
  embargo: [1, 1, 1, 1, 1],
  "full-shield": [0, 0, 1, 1, 1],
  "last-stand": [0, 1, 1, 1, 1],
  ceasefire: [1, 1, 1, 1, 1],
  "risk-pledge": [0, 1, 1, 1, 1],
  "forced-draw": [0, 0, 1, 1, 1],
  redraw: [1, 2, 2, 2, 2],
  scry: [1, 1, 1, 1, 1],
  "deck-rotate": [1, 1, 1, 1, 1],
  trim: [0, 1, 1, 1, 1],
  "reveal-self": [1, 1, 2, 2, 2],
  "reveal-opponent": [0, 0, 1, 1, 1],
  "target-lock": [0, 1, 1, 1, 1],
  "table-exchange": [0, 0, 1, 1, 1],
  suppress: [0, 1, 1, 1, 1],
  decommission: [1, 1, 1, 1, 1],
  "banish-copy": [0, 0, 1, 1, 1],
  "heavy-hit": [0, 0, 1, 1, 1],
  "face-lighten": [1, 1, 1, 1, 1],
  "face-burden": [1, 1, 1, 1, 1],
  resonance: [0, 1, 1, 1, 1],
  "supply-cache": [1, 1, 1, 1, 1],
  "life-trade": [0, 1, 1, 1, 1],
  "purge-hand": [0, 1, 1, 1, 1],
  "safe-hit": [0, 0, 1, 1, 1],
  regret: [2, 3, 3, 4, 5],
  "skill-revival": [0, 0, 0, 1, 1],
  "sudden-death": [0, 0, 0, 0, 1],
} as const);
export type StockDefinitionId = keyof typeof STOCK_QUANTITIES;

/** Only explicit admitted IDs enter a runtime pool; no default catalog enablement. */
export function createResourcePreset(
  difficulty: Difficulty,
  admitted: readonly string[],
): TrumpResourceRules {
  const index = DIFFICULTIES.indexOf(difficulty);
  if (
    index < 0 ||
    new Set(admitted).size !== admitted.length ||
    admitted.some((id) => !Object.hasOwn(STOCK_QUANTITIES, id))
  )
    throw new RangeError("Invalid resource preset");
  return freezeData({
    difficulty,
    handLimit: 8,
    gameGrant: 2,
    roundGrant: 1,
    hitProbability: HIT_PROBABILITIES[difficulty],
    stock: Object.fromEntries(
      admitted.map((id) => [
        id,
        STOCK_QUANTITIES[id as StockDefinitionId][index],
      ]),
    ),
  });
}
