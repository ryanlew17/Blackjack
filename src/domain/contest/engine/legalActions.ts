// @req REQ-2026-015: legality depends only on the actor's observation.
import type { RoundCommand, RoundObservation } from "./types";

export function legalActions(
  view: RoundObservation,
): readonly RoundCommand["type"][] {
  if (view.phase !== "acting" || view.turn?.player !== view.viewer) return [];
  return view.deckCount > 0 ? ["Hit", "Stay"] : ["Stay"];
}
