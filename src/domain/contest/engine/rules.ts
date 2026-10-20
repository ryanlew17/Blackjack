// @req REQ-2026-015: one immutable snapshot feeds execution and observations.
import { freezeData } from "../immutable";
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
  if (rules.trumps) {
    const definitions = Object.fromEntries(
      Object.entries(rules.trumps.definitions).map(([id, definition]) => {
        if (
          definition.table &&
          definition.table.pointTarget !== null &&
          (!Number.isSafeInteger(definition.table.pointTarget) ||
            definition.table.pointTarget < 1)
        )
          throw new RangeError("Invalid table target");
        return [
          id,
          {
            onPlay: definition.onPlay.map((effect) => ({ ...effect })),
            ...(definition.table ? { table: { ...definition.table } } : {}),
          },
        ];
      }),
    );
    if (rules.trumps.tableCapacity !== 5)
      throw new RangeError("Invalid table capacity");
    // Reuse the already validated snapshot in every subsequent Round.
    if (
      Object.isFrozen(rules) &&
      Object.isFrozen(rules.trumps) &&
      Object.isFrozen(rules.trumps.definitions) &&
      Object.values(rules.trumps.definitions).every(
        (d) =>
          Object.isFrozen(d) &&
          Object.isFrozen(d.onPlay) &&
          d.onPlay.every(Object.isFrozen) &&
          (!d.table || Object.isFrozen(d.table)),
      )
    )
      return rules;
    return freezeData({
      version: rules.version,
      pointTarget: rules.pointTarget,
      trumps: { tableCapacity: 5, definitions },
    });
  }
  return Object.isFrozen(rules)
    ? rules
    : Object.freeze({ version: rules.version, pointTarget: rules.pointTarget });
}

// @req REQ-2026-016/019: fixed format; explicit fixture resources do not enable dealing.
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
