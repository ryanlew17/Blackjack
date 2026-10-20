// @req REQ-2026-015: one immutable snapshot feeds execution and observations.
import type { RoundRules } from "./types";

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
