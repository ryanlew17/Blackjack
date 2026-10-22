// @req REQ-2026-025: the only production execution set; no duplicated candidate effects.
import { freezeData } from "../immutable";
import type { TrumpDefinition } from "../engine/effectTypes";
import { TRUMP_IDS, type TrumpId } from "./ids";
import { NUMBER_TRUMP_DEFINITIONS } from "./numberDefinitions";
import { INTERACTION_TRUMP_DEFINITIONS } from "./interactionDefinitions";

export type AdmittedTrumpId = Exclude<TrumpId, "skill-revival">;
export const ADMITTED_TRUMP_DEFINITIONS: Readonly<
  Record<AdmittedTrumpId, TrumpDefinition>
> = freezeData({
  ...NUMBER_TRUMP_DEFINITIONS,
  ...INTERACTION_TRUMP_DEFINITIONS,
} satisfies Record<AdmittedTrumpId, TrumpDefinition>);

export function isAdmittedTrumpId(value: unknown): value is AdmittedTrumpId {
  return (
    typeof value === "string" &&
    Object.hasOwn(ADMITTED_TRUMP_DEFINITIONS, value)
  );
}
export const ADMITTED_TRUMP_IDS = Object.freeze(
  TRUMP_IDS.filter(isAdmittedTrumpId),
);
