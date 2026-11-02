// @req REQ-2026-027: skill availability depends only on the actor observation.
// @req REQ-2026-024: ordinary Hit respects the exact active Quiet Window.
// @req REQ-2026-015: legality depends only on the actor's observation.
import { legalSkillCommands } from "./skills";
import { legalTrumpCommands } from "./effects";
import type { RoundCommand, RoundObservation } from "./types";
import { affectsTurn, isEffectActive } from "./tableEffects";

export function legalActions(
  view: RoundObservation,
): readonly RoundCommand["type"][] {
  if (view.phase !== "acting" || !view.turn) return [];
  if (view.reaction) {
    if (view.reaction.player !== view.viewer) return [];
    return legalSkillCommands(view).length
      ? ["ActivateSkill", "PassReaction"]
      : ["PassReaction"];
  }
  if (view.turn.player !== view.viewer) return [];
  if (view.turn.controlledBy !== undefined) return ["ResolveForcedTurn"];
  const actions: RoundCommand["type"][] = ordinaryHitAvailable(view)
    ? ["Hit", "Stay"]
    : ["Stay"];
  if (legalTrumpCommands(view).length) actions.push("PlayTrump");
  if (legalSkillCommands(view).length) actions.push("ActivateSkill");
  return actions;
}

/** Public draw restrictions, also applied to each internal controlled Hit. */
export function ordinaryHitAvailable(view: RoundObservation): boolean {
  return (
    view.deckCount > 0 &&
    !view.trumps?.table.some(
      (t) =>
        t.kind === "hush" &&
        affectsTurn(t, view.turn) &&
        isEffectActive(t, view.trumps!.table),
    )
  );
}
