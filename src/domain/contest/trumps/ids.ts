// @req REQ-2026-013: stable definition IDs, independent of runtime instances.
export const TRUMP_IDS = Object.freeze([
  "draw-2",
  "draw-3",
  "draw-4",
  "draw-5",
  "draw-6",
  "draw-7",
  "return",
  "remove",
  "exchange",
  "target-17",
  "target-24",
  "target-27",
  "destroy",
  "destroy-all",
  "best-draw",
  "pressure",
  "pressure-supply",
  "shield",
  "shared-supply",
  "resource-swap",
  "harvest",
] as const);
export type TrumpId = (typeof TRUMP_IDS)[number];
export function isTrumpId(value: unknown): value is TrumpId {
  return typeof value === "string" && TRUMP_IDS.some((id) => id === value);
}
