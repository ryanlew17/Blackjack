// @req REQ-2026-024: interpret suppression for numeric contributions and transferred records.
// @req REQ-2026-023: one contribution model for authority, authorized views and best draw.
import type { PlayerId } from "../types";
import type { NumberInstance } from "./numberCards";
import type { RoundState } from "./types";
import type { TableEffect } from "./effectTypes";
import { isEffectActive } from "./tableEffects";

export const TRANSFERABLE_TABLE_IDS = Object.freeze([
  "pressure",
  "pressure-supply",
  "shield",
  "full-shield",
  "last-stand",
  "risk-pledge",
  "harvest",
  "supply-cache",
] as const);
export function transferable(effect: TableEffect): boolean {
  return (
    effect.pointTarget === null &&
    (!effect.kind || TRANSFERABLE_TABLE_IDS.some((id) => id === effect.kind)) &&
    TRANSFERABLE_TABLE_IDS.some((id) => id === effect.definitionId)
  );
}
export function contribution(
  state: RoundState,
  player: PlayerId,
  card: NumberInstance,
): number {
  if (card.instanceId === state.hiddenCards[player])
    return card.value * state.hiddenMultipliers[player];
  const adjustment = (state.trumps?.table ?? [])
    .filter(
      (t) =>
        isEffectActive(t, state.trumps!.table) && t.cardId === card.instanceId,
    )
    .reduce((sum, t) => sum + (t.adjustment ?? 0), 0);
  return Math.max(1, card.value + adjustment);
}
export function effectiveTotals(
  state: RoundState,
  settlement = false,
): Readonly<Record<PlayerId, number>> {
  const totals = {
    human: state.hands.human.reduce(
      (n, c) => n + contribution(state, "human", c),
      0,
    ),
    ai: state.hands.ai.reduce((n, c) => n + contribution(state, "ai", c), 0),
  };
  if (
    settlement &&
    state.trumps?.table.some(
      (t) => t.kind === "symbiosis" && isEffectActive(t, state.trumps!.table),
    )
  ) {
    const human = state.hands.human.find(
      (c) => c.instanceId === state.hiddenCards.human,
    );
    const ai = state.hands.ai.find(
      (c) => c.instanceId === state.hiddenCards.ai,
    );
    // Capture both contributions before changing either total.
    const h = human ? contribution(state, "human", human) : 0;
    const a = ai ? contribution(state, "ai", ai) : 0;
    totals.human += a;
    totals.ai += h;
  }
  return totals;
}
export function tablePointTarget(state: RoundState): number {
  return (
    state.trumps?.table.find(
      (t) => t.pointTarget !== null && isEffectActive(t, state.trumps!.table),
    )?.pointTarget ?? state.rules.pointTarget
  );
}
export function sameGlobalGroup(
  a: { pointTarget: number | null; kind?: string },
  b: { pointTarget: number | null; kind?: string },
): boolean {
  return (
    ((a.pointTarget !== null || a.kind === "resonance") &&
      (b.pointTarget !== null || b.kind === "resonance")) ||
    (a.kind !== undefined &&
      ["symbiosis", "ceasefire", "target-lock"].includes(a.kind) &&
      a.kind === b.kind)
  );
}
