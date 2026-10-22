// @req REQ-2026-025: human commands and explicit S2 admission; authority remains private.
import { S2_DEVELOPMENT_PRESET } from "../../domain/contest/presets/s2";
import { createContestCoordinator } from "./coordinator";
import type { ContestInput, ContestControllerOptions } from "./types";

export function createContestController(
  options: ContestControllerOptions = {},
) {
  const { preset, ...ports } = options;
  const { sendCommand, ...controls } = createContestCoordinator({
    ...ports,
    ...(preset === "s2-development"
      ? { roundRules: S2_DEVELOPMENT_PRESET.round }
      : {}),
  });
  return {
    ...controls,
    send(action: ContestInput) {
      if (typeof action === "string") {
        if (action !== "Hit" && action !== "Stay" && action !== "NextRound")
          return false;
        return sendCommand(
          action === "NextRound"
            ? { type: action }
            : { type: action, player: "human" },
        );
      }
      if (
        action.type !== "PlayTrump" ||
        !controls
          .getSnapshot()
          .trumpCommands.some((c) => c.inputId === action.inputId)
      )
        return false;
      return sendCommand({
        type: "PlayTrump",
        player: "human",
        instanceId: action.instanceId,
        targetId: action.targetId,
        ownTargetId: action.ownTargetId,
        costIds: action.costIds,
        definitionId: action.definitionId,
      });
    },
  };
}
