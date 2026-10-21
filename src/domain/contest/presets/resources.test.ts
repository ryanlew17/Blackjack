// @req REQ-2026-022: check resource data against its independently written requirement.
import { describe, expect, it } from "vitest";
import baseline from "../../../../docs/requirements/archive/REQ-2026-021-contest-trump-rule-contract.md?raw";
import { STOCK_QUANTITIES, createResourcePreset } from "./resources";
import { DIFFICULTIES } from "../types";
describe("54-definition stock quantities", () => {
  it("retains all 51 original quantities and adds the three specified cards", () => {
    const rows = baseline
      .split("\n")
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim()),
      )
      .filter((c) => c.length === 7 && /^\x60[^\x60]+\x60$/.test(c[0]));
    expect(rows).toHaveLength(51);
    for (const row of rows)
      expect(
        STOCK_QUANTITIES[row[0].slice(1, -1) as keyof typeof STOCK_QUANTITIES],
      ).toEqual(row[3].split("/").map(Number));
    expect(STOCK_QUANTITIES.regret).toEqual([2, 3, 3, 4, 5]);
    expect(STOCK_QUANTITIES["skill-revival"]).toEqual([0, 0, 0, 1, 1]);
    expect(STOCK_QUANTITIES["sudden-death"]).toEqual([0, 0, 0, 0, 1]);
    expect(Object.keys(STOCK_QUANTITIES)).toHaveLength(54);
    expect(
      DIFFICULTIES.map((_, i) =>
        Object.values(STOCK_QUANTITIES).reduce<number>(
          (sum, q) => sum + q[i],
          0,
        ),
      ),
    ).toEqual([39, 61, 73, 76, 78]);
    expect(Object.isFrozen(STOCK_QUANTITIES)).toBe(true);
    expect(Object.values(STOCK_QUANTITIES).every(Object.isFrozen)).toBe(true);
  });
  it("filters to explicit admitted IDs, freezes each policy, and grants no automatic catalog admission", () => {
    for (const difficulty of DIFFICULTIES) {
      const policy = createResourcePreset(difficulty, [
        "return",
        "destroy-all",
      ]);
      expect(Object.keys(policy.stock)).toEqual(["return", "destroy-all"]);
      expect(policy.stock["destroy-all"]).toBe(difficulty === "easy" ? 0 : 1);
      expect(policy.stock.return).toBe(
        STOCK_QUANTITIES.return[DIFFICULTIES.indexOf(difficulty)],
      );
      expect(Object.isFrozen(policy)).toBe(true);
      expect(Object.isFrozen(policy.stock)).toBe(true);
      expect(policy).not.toHaveProperty("earliestDifficulty");
    }
    expect(createResourcePreset("standard", []).stock).toEqual({});
    expect(() => createResourcePreset("standard", ["unknown"])).toThrow(
      RangeError,
    );
    expect(() =>
      createResourcePreset("standard", ["return", "return"]),
    ).toThrow(RangeError);
  });
});
