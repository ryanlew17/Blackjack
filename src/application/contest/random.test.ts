// @req REQ-2026-025: independently advancing production defaults, not three Math.random aliases.
import { expect, it, vi } from "vitest";
import { createContestRandomSources } from "./random";

it("does not seed idle sources, and initializes all streams together on first use", () => {
  const seed = vi.fn(() => 0.25),
    random = createContestRandomSources(seed);
  expect(seed).not.toHaveBeenCalled();
  random.numbers();
  expect(seed).toHaveBeenCalledTimes(3);
  random.trumpGate();
  random.trumpSelection();
  random.numbers();
  expect(seed).toHaveBeenCalledTimes(3);
});
it("keeps number, gate and selection sequences independent of the other streams' workloads", () => {
  const create = () => {
    let seed = 0;
    return createContestRandomSources(() => ++seed / 10);
  };
  const a = create(),
    b = create();
  expect(a.numbers()).toBe(b.numbers());
  for (let i = 0; i < 100; i++) {
    a.trumpGate();
    a.trumpSelection();
  }
  const numbers = Array.from({ length: 200 }, () => a.numbers());
  expect(numbers).toEqual(Array.from({ length: 200 }, () => b.numbers()));
  expect(numbers.every((n) => n >= 0 && n < 1)).toBe(true);
  expect(new Set(numbers).size).toBe(200);
  const c = create(),
    d = create();
  for (let i = 0; i < 100; i++) {
    c.numbers();
    c.trumpGate();
  }
  expect(Array.from({ length: 200 }, () => c.trumpSelection())).toEqual(
    Array.from({ length: 200 }, () => d.trumpSelection()),
  );
  const e = create(),
    f = create();
  for (let i = 0; i < 100; i++) {
    e.numbers();
    e.trumpSelection();
  }
  expect(Array.from({ length: 200 }, () => e.trumpGate())).toEqual(
    Array.from({ length: 200 }, () => f.trumpGate()),
  );
});
