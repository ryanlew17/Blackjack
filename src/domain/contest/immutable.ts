// @req REQ-2026-013: immutable static data, local to the two contest data consumers.
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

// @req REQ-2026-028: reuse recently certified immutable subtrees with bounded retention.
const deeplyFrozen = new Set<object>();
const FREEZE_CACHE_SIZE = 4096;
const frozenOrder: object[] = [];
let nextFrozen = 0;

export function freezeData<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !deeplyFrozen.has(value)) {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
    deeplyFrozen.add(value);
    if (frozenOrder.length < FREEZE_CACHE_SIZE) frozenOrder.push(value);
    else {
      deeplyFrozen.delete(frozenOrder[nextFrozen]);
      frozenOrder[nextFrozen] = value;
      nextFrozen = (nextFrozen + 1) % FREEZE_CACHE_SIZE;
    }
  }
  return value as DeepReadonly<T>;
}

/** True only for trees recursively frozen by this module, not external shallow freezes. */
export const isFrozenData = (value: object): boolean => deeplyFrozen.has(value);
