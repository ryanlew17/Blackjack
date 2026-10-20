// @req REQ-2026-017: replaceable application placeholder, not the formal AI.
import type { OpponentPolicy } from "./types";

export const placeholderOpponent: OpponentPolicy = (view, actions) => {
  const total = view.round.hands.ai.total;
  return total !== null && total < 17 && actions.includes("Hit")
    ? "Hit"
    : "Stay";
};
