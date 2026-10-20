// @req REQ-2026-015: one immutable snapshot feeds execution and observations.
import type { MatchRules, RoundRules } from "./types";

export const DEFAULT_ROUND_RULES: RoundRules = Object.freeze({
  version: 1,
  pointTarget: 21,
});

export function snapshotRoundRules(rules: RoundRules): RoundRules {
  if (
    rules.version !== 1 ||
    !Number.isSafeInteger(rules.pointTarget) ||
    rules.pointTarget < 1
  )
    throw new RangeError("Invalid contest round rules");
  return Object.isFrozen(rules)
    ? rules
    : Object.freeze({ version: rules.version, pointTarget: rules.pointTarget });
}

// @req REQ-2026-016: no configurable difficulty or experimental resources yet.
export function createMatchRules(
  roundRules: RoundRules = DEFAULT_ROUND_RULES,
): MatchRules {
  return Object.freeze({
    version: 1,
    difficulty: "standard",
    bestOf: 5,
    gamesToWin: 3,
    initialGameTarget: 5,
    targetIncrement: 2,
    trumpDealing: false,
    round: snapshotRoundRules(roundRules),
  });
}
