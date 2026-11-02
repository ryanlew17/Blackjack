// @req REQ-2026-027: include skill streams in lazy seed initialization.
// @req REQ-2026-025: independently advancing production defaults, not three Math.random aliases.
import { expect, it, vi } from "vitest";
import { createContestRandomSources } from "./random";

it("does not seed idle sources, and initializes all streams together on first use", () => {
  const seed = vi.fn(() => 0.25),
    random = createContestRandomSources(seed);
  expect(seed).not.toHaveBeenCalled();
  random.numbers();
  expect(seed).toHaveBeenCalledTimes(5);
  random.trumpGate();
  random.trumpSelection();
  random.numbers();
  expect(seed).toHaveBeenCalledTimes(5);
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

// @req REQ-2026-027: skill selection and true effects cannot advance one another or ordinary resources.
it("keeps all five deterministic stream workloads independent", () => {
  const keys = [
    "numbers",
    "trumpGate",
    "trumpSelection",
    "skillSelection",
    "skillEffects",
  ] as const;
  const create = () => {
    let seed = 0;
    return createContestRandomSources(() => ++seed / 10);
  };
  for (const subject of keys) {
    const clean = create(),
      loaded = create();
    for (const other of keys)
      if (other !== subject) for (let i = 0; i < 150; i++) loaded[other]();
    expect(Array.from({ length: 50 }, () => loaded[subject]())).toEqual(
      Array.from({ length: 50 }, () => clean[subject]()),
    );
  }
});
