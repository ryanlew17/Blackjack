// @req REQ-2026-024: validate interaction kinds and hidden all-other costs before RNG.
// @req REQ-2026-023: numeric contributions, authorized information and reversible effects.
// @req REQ-2026-015/022: validate all public configuration before any random call.
import { freezeData } from "../immutable";
import { DIFFICULTIES } from "../types";
import type { MatchRules, RoundRules } from "./types";
import type { TrumpEffect } from "./effectTypes";
import { TABLE_KINDS } from "./effectTypes";
import { HIT_PROBABILITIES } from "./resourceTypes";
import { NUMBER_VALUES } from "./numbers";

export const DEFAULT_ROUND_RULES: RoundRules = Object.freeze({
  version: 1,
  pointTarget: 21,
});

function validEffect(effect: TrumpEffect, definitions: object): boolean {
  switch (effect.type) {
    case "draw-number":
    case "generate-number":
      return NUMBER_VALUES.includes(effect.value);
    case "return-last":
      return (
        effect.target === undefined ||
        effect.target === "self" ||
        effect.target === "opponent"
      );
    case "draw-best":
    case "swap-last":
    case "rotate-deck":
    case "trim":
    case "exchange-table":
    case "undo-last":
    case "sudden-death":
      return true;
    case "scry":
      return effect.count === 2;
    case "hidden-multiplier":
      return (
        (effect.target === "self" || effect.target === "opponent") &&
        (effect.value === 1 || effect.value === 2)
      );
    case "remove-table":
    case "delete-stock":
    case "remove-latest":
    case "remove-all":
    case "reveal-hidden":
      return effect.target === "self" || effect.target === "opponent";
    case "delete-last-number":
      return effect.target === "self" || effect.target === "opponent";
    case "draw-top":
    case "grant-trumps":
      return (
        (effect.target === "self" || effect.target === "opponent") &&
        Number.isSafeInteger(effect.count) &&
        effect.count > 0 &&
        (effect.type !== "grant-trumps" ||
          effect.definitionId === undefined ||
          Object.hasOwn(definitions, effect.definitionId))
      );
    case "generate-trump":
      return Object.hasOwn(definitions, effect.definitionId);
    default:
      return false;
  }
}
export function snapshotRoundRules(rules: RoundRules): RoundRules {
  if (
    rules.version !== 1 ||
    !Number.isSafeInteger(rules.pointTarget) ||
    rules.pointTarget < 1
  )
    throw new RangeError("Invalid contest round rules");
  if (!rules.trumps)
    return Object.isFrozen(rules)
      ? rules
      : Object.freeze({
          version: rules.version,
          pointTarget: rules.pointTarget,
        });
  const trumps = rules.trumps;
  if (trumps.tableCapacity !== 5)
    throw new RangeError("Invalid table capacity");
  const definitions = Object.fromEntries(
    Object.entries(trumps.definitions).map(([id, d]) => {
      if (
        !id ||
        !Array.isArray(d.onPlay) ||
        !d.onPlay.every((e) => validEffect(e, trumps.definitions)) ||
        (d.cost !== undefined &&
          d.cost !== "all-other" &&
          (!Number.isSafeInteger(d.cost) || d.cost < 0 || d.cost > 7)) ||
        (d.table &&
          ((d.table.pointTarget !== null &&
            (!Number.isSafeInteger(d.table.pointTarget) ||
              d.table.pointTarget < 1)) ||
            (d.table.kind !== undefined &&
              (!TABLE_KINDS.includes(d.table.kind) ||
                d.table.pointTarget !== null)) ||
            (d.table.remainingCharges !== undefined &&
              (!Number.isSafeInteger(d.table.remainingCharges) ||
                d.table.remainingCharges < 0))))
      )
        throw new RangeError("Invalid trump definition");
      return [
        id,
        {
          onPlay: d.onPlay.map((e) => ({ ...e })),
          ...(d.cost !== undefined ? { cost: d.cost } : {}),
          ...(d.table ? { table: { ...d.table } } : {}),
        },
      ];
    }),
  );
  const resource = trumps.resources;
  if (resource) {
    const counts = Object.entries(resource.stock);
    if (
      !DIFFICULTIES.includes(resource.difficulty) ||
      resource.handLimit !== 8 ||
      resource.gameGrant !== 2 ||
      resource.roundGrant !== 1 ||
      resource.hitProbability !== HIT_PROBABILITIES[resource.difficulty] ||
      counts.some(
        ([id, count]) =>
          !Object.hasOwn(definitions, id) ||
          !Number.isSafeInteger(count) ||
          count < 0,
      ) ||
      !Number.isSafeInteger(counts.reduce((sum, [, count]) => sum + count, 0))
    )
      throw new RangeError("Invalid trump resource policy");
  }
  if (
    Object.isFrozen(rules) &&
    Object.isFrozen(trumps) &&
    Object.isFrozen(trumps.definitions) &&
    Object.values(trumps.definitions).every(
      (d) =>
        Object.isFrozen(d) &&
        Object.isFrozen(d.onPlay) &&
        d.onPlay.every(Object.isFrozen) &&
        (!d.table || Object.isFrozen(d.table)),
    ) &&
    (!resource ||
      (Object.isFrozen(resource) && Object.isFrozen(resource.stock)))
  )
    return rules;
  return freezeData({
    version: rules.version,
    pointTarget: rules.pointTarget,
    trumps: {
      tableCapacity: 5,
      definitions,
      ...(resource
        ? { resources: { ...resource, stock: { ...resource.stock } } }
        : {}),
    },
  });
}
export function createMatchRules(
  roundRules: RoundRules = DEFAULT_ROUND_RULES,
): MatchRules {
  const round = snapshotRoundRules(roundRules);
  return Object.freeze({
    version: 1,
    difficulty: "standard",
    bestOf: 5,
    gamesToWin: 3,
    initialGameTarget: 5,
    targetIncrement: 2,
    trumpDealing: !!round.trumps?.resources,
    round,
  });
}
