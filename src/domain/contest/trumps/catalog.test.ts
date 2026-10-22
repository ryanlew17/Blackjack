// @req REQ-2026-013/025: catalog identity, provenance and execution admission.
import { describe, expect, it } from "vitest";
import { TRUMP_CATALOG, findTrump } from "./catalog";
import { TRUMP_IDS, isTrumpId } from "./ids";
import { ADMITTED_TRUMP_DEFINITIONS, ADMITTED_TRUMP_IDS } from "./admitted";
import { NUMBER_TRUMP_DEFINITIONS } from "./numberDefinitions";
import { INTERACTION_TRUMP_DEFINITIONS } from "./interactionDefinitions";
import { DIFFICULTIES } from "../types";
import {
  CANDIDATE_AVAILABILITY,
  EXPERIMENTAL_F1_P0,
} from "../presets/experimental";
import { STOCK_QUANTITIES, createResourcePreset } from "../presets/resources";
import { S2_DEVELOPMENT_PRESET } from "../presets/s2";

describe("registered catalog and explicit admission", () => {
  it("registers 54 identities and admits precisely the 53 executed definitions", () => {
    expect(TRUMP_IDS).toHaveLength(54);
    expect(new Set(TRUMP_IDS).size).toBe(54);
    expect(Object.keys(TRUMP_CATALOG)).toEqual([...TRUMP_IDS]);
    expect(ADMITTED_TRUMP_IDS).toHaveLength(53);
    expect(new Set(Object.keys(ADMITTED_TRUMP_DEFINITIONS))).toEqual(
      new Set(ADMITTED_TRUMP_IDS),
    );
    for (const id of TRUMP_IDS) {
      const card = findTrump(id)!;
      expect(card).toBe(TRUMP_CATALOG[id]);
      expect(card.id).toBe(id);
      expect(card.nameKey).toBe(`contest.trump.${id}.name`);
      expect(card.descriptionKey).toBe(`contest.trump.${id}.description`);
      expect(card.playable).toBe(id !== "skill-revival");
      expect(card.admission).toBe(
        id === "skill-revival" ? "pending-skill" : "admitted",
      );
      if (id === "skill-revival") expect(card.execution).toBeNull();
      else expect(card.execution).toBe(ADMITTED_TRUMP_DEFINITIONS[id]);
    }
    // These references are the existing 023/024 implementation, never translated copies.
    for (const [id, execution] of Object.entries({
      ...NUMBER_TRUMP_DEFINITIONS,
      ...INTERACTION_TRUMP_DEFINITIONS,
    })) {
      expect(findTrump(id)!.execution).toBe(execution);
    }
  });
  it.each(["__proto__", "constructor", "draw-1", "draw-11", "", null, 2])(
    "rejects unknown identity %s",
    (value) => {
      expect(isTrumpId(value)).toBe(false);
      expect(findTrump(value)).toBeUndefined();
    },
  );
  it("preserves old references and labels project designs with their actual requirement sources", () => {
    expect(findTrump("draw-2")!.provenance).toEqual({
      referenceName: "2 Card",
      sourceIds: ["W2"],
    });
    for (const id of TRUMP_IDS.slice(21)) {
      expect(findTrump(id)!.provenance.sourceIds).toEqual([
        ["regret", "skill-revival", "sudden-death"].includes(id)
          ? "REQ-022"
          : "REQ-021",
      ]);
    }
  });
  it("keeps the full catalog, executions, quantities and development preset deeply frozen", () => {
    const verify = (value: unknown) => {
      if (value && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(verify);
      }
    };
    [
      TRUMP_CATALOG,
      ADMITTED_TRUMP_IDS,
      ADMITTED_TRUMP_DEFINITIONS,
      STOCK_QUANTITIES,
      S2_DEVELOPMENT_PRESET,
      EXPERIMENTAL_F1_P0,
    ].forEach(verify);
    expect(() => {
      (findTrump("pressure") as { playable: boolean }).playable = false;
    }).toThrow();
  });
  it("uses current quantities for admission and retains the isolated historical F1/P0 values", () => {
    expect(
      DIFFICULTIES.map((d) =>
        Object.values(CANDIDATE_AVAILABILITY).reduce(
          (n, c) => n + c.copiesPerSide[d],
          0,
        ),
      ),
    ).toEqual([16, 22, 26, 29, 30]);
    expect(
      DIFFICULTIES.map((d) =>
        Object.values(createResourcePreset(d, ADMITTED_TRUMP_IDS).stock).reduce(
          (n, c) => n + c,
          0,
        ),
      ),
    ).toEqual([39, 61, 73, 75, 77]);
    expect(Object.keys(STOCK_QUANTITIES)).toEqual([...TRUMP_IDS]);
    expect(S2_DEVELOPMENT_PRESET.round.trumps.resources).toEqual(
      createResourcePreset("standard", ADMITTED_TRUMP_IDS),
    );
    expect(
      S2_DEVELOPMENT_PRESET.round.trumps.resources.stock,
    ).not.toHaveProperty("skill-revival");
    expect(EXPERIMENTAL_F1_P0.playable).toBe(false);
    for (const card of Object.values(TRUMP_CATALOG))
      expect(card).not.toHaveProperty("earliestDifficulty");
  });
});
