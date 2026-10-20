// @req REQ-2026-020: deterministic S1 baseline; observation in, Hit/Stay out.
import type { MatchObservation } from "../engine/types";

export type BaselineAction = "Hit" | "Stay";
export type BaselinePolicy = (
  observation: MatchObservation,
  actions: readonly BaselineAction[],
) => BaselineAction;

/** All difficulties share this baseline until the final S2 AI requirement. */
export const baselinePolicy: BaselinePolicy = (observation, actions) => {
  const total = observation.round.hands[observation.round.viewer].total;
  return total !== null && total < 17 && actions.includes("Hit")
    ? "Hit"
    : "Stay";
};
