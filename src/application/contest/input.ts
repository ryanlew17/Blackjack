// @req REQ-2026-027: canonical authorized commands are the public skill/reaction boundary.
import type { RoundCommand } from "../../domain/contest/engine";
import type { ContestInput, ContestView } from "./types";

type Submit = (
  command: (RoundCommand | { readonly type: "NextRound" }) & {
    readonly inputId?: number;
  },
) => boolean;

export function sendContestInput(
  action: ContestInput,
  view: ContestView,
  submit: Submit,
): boolean {
  if (typeof action === "string") {
    if (action !== "Hit" && action !== "Stay" && action !== "NextRound")
      return false;
    return submit(
      action === "NextRound"
        ? { type: action }
        : { type: action, player: "human" },
    );
  }
  if (action.type === "ActivateSkill") {
    if ("player" in action && action.player !== "human") return false;
    const command = view.skillCommands.find(
      (c) =>
        c.inputId === action.inputId &&
        c.skillId === action.skillId &&
        c.turnNumber === action.turnNumber &&
        c.reactionBoundary === action.reactionBoundary,
    );
    return command ? submit({ ...command, player: "human" }) : false;
  }
  if (action.type === "PassReaction") {
    if ("player" in action && action.player !== "human") return false;
    const command = view.reaction?.pass;
    return command &&
      command.inputId === action.inputId &&
      command.turnNumber === action.turnNumber &&
      command.reactionBoundary === action.reactionBoundary
      ? submit({ ...command, player: "human" })
      : false;
  }
  if (
    action.type !== "PlayTrump" ||
    !view.trumpCommands.some((c) => c.inputId === action.inputId)
  )
    return false;
  return submit({
    type: "PlayTrump",
    player: "human",
    instanceId: action.instanceId,
    targetId: action.targetId,
    ownTargetId: action.ownTargetId,
    costIds: action.costIds,
    definitionId: action.definitionId,
  });
}
