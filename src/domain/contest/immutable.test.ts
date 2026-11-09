// @req REQ-2026-028: cache only recursively frozen trees, never shallow external freezes.
import { expect, it } from "vitest";
import { freezeData } from "./immutable";
it("freezes children of externally frozen objects and reuses verified shared subtrees", () => {
  const child = { values: [1, 2] };
  const external = Object.freeze({ child });
  expect(freezeData(external)).toBe(external);
  expect(Object.isFrozen(child)).toBe(true);
  expect(Object.isFrozen(child.values)).toBe(true);
  expect(() => child.values.push(3)).toThrow();
  expect(freezeData({ a: external, b: external }).a).toBe(external);
});
