// @req REQ-2026-019: production adapter keeps human-only Hit/Stay/NextRound API.
import { createContestCoordinator } from "./coordinator";
import type { ContestAction, ContestControllerOptions } from "./types";

export function createContestController(
  options: ContestControllerOptions = {},
) {
  const { sendCommand, ...controls } = createContestCoordinator(options);
  return {
    ...controls,
    send(type: ContestAction) {
      return sendCommand(
        type === "NextRound" ? { type } : { type, player: "human" },
      );
    },
  };
}
