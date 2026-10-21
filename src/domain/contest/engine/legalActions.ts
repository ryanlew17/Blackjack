// @req REQ-2026-024: ordinary Hit respects the exact active Quiet Window.
// @req REQ-2026-015: legality depends only on the actor's observation.
import { legalTrumpCommands } from "./effects";
import type { RoundCommand, RoundObservation } from "./types";
import { affectsTurn, isEffectActive } from "./tableEffects";

export function legalActions(
  view: RoundObservation,
): readonly RoundCommand["type"][] {
  if (view.phase !== "acting" || view.turn?.player !== view.viewer) return [];
  const actions: RoundCommand["type"][] =
    view.deckCount > 0 &&
    !view.trumps?.table.some(
      (t) =>
        t.kind === "hush" &&
        affectsTurn(t, view.turn) &&
        isEffectActive(t, view.trumps!.table),
    )
      ? ["Hit", "Stay"]
      : ["Stay"];
  return legalTrumpCommands(view).length ? [...actions, "PlayTrump"] : actions;
}
