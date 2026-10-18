// @req REQ-2026-013
import { describe, expect, it } from "vitest";
import { TRUMP_CATALOG, findTrump } from "./catalog";
import { TRUMP_IDS, isTrumpId } from "./ids";
import type { TrumpDefinition } from "./types";
import { DIFFICULTIES } from "../types";
import {
  CANDIDATE_AVAILABILITY,
  EXPERIMENTAL_F1_P0,
} from "../presets/experimental";

describe("candidate data integrity", () => {
  it("has 21 unique, queryable, non-playable definitions with distinct copy keys", () => {
    expect(TRUMP_IDS).toHaveLength(21);
    expect(new Set(TRUMP_IDS).size).toBe(21);
    expect(Object.keys(TRUMP_CATALOG)).toEqual([...TRUMP_IDS]);
    for (const id of TRUMP_IDS) {
      const card: TrumpDefinition = TRUMP_CATALOG[id];
      expect(findTrump(id)).toBe(card);
      expect(card.id).toBe(id);
      expect(card.nameKey).toBe(`contest.trump.${id}.name`);
      expect(card.descriptionKey).toBe(`contest.trump.${id}.description`);
      expect(card.playable).toBe(false);
      expect(card.provenance.sourceIds.length).toBeGreaterThan(0);
      expect(
        card.onPlay.length + (card.table?.effects.length ?? 0),
      ).toBeGreaterThan(0);
    }
  });
  it.each(["__proto__", "constructor", "draw-1", "draw-11", "", null, 2])(
    "rejects unknown identity %s",
    (value) => {
      expect(isTrumpId(value)).toBe(false);
      expect(findTrump(value)).toBeUndefined();
    },
  );
  it("keeps all nested catalog and preset data immutable", () => {
    const verify = (value: unknown) => {
      if (value && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(verify);
      }
    };
    verify(TRUMP_CATALOG);
    verify(CANDIDATE_AVAILABILITY);
    verify(EXPERIMENTAL_F1_P0);
    expect(() => {
      (TRUMP_CATALOG.pressure as unknown as { playable: boolean }).playable =
        true;
    }).toThrow();
  });
  it("agrees on each first difficulty and the five independently specified totals", () => {
    const totals = DIFFICULTIES.map((d) =>
      TRUMP_IDS.reduce(
        (sum, id) => sum + CANDIDATE_AVAILABILITY[id].copiesPerSide[d],
        0,
      ),
    );
    expect(totals).toEqual([16, 22, 26, 29, 30]);
    for (const id of TRUMP_IDS) {
      const data = CANDIDATE_AVAILABILITY[id];
      expect(DIFFICULTIES.find((d) => data.copiesPerSide[d] > 0)).toBe(
        data.earliestDifficulty,
      );
      for (const count of Object.values(data.copiesPerSide)) {
        expect(Number.isSafeInteger(count) && count >= 0).toBe(true);
      }
    }
  });
  it.each([2, 3, 4, 5, 6, 7])(
    "describes draw %i without a hidden-card precondition",
    (n) => {
      const card = findTrump(`draw-${n}`)!;
      expect(card.conditions).toEqual([]);
      expect(card.onPlay).toEqual([{ kind: "drawNumber", value: n }]);
      expect(card.failedResolution).toBe("consume");
      expect(card.table).toBeNull();
    },
  );
  it("protects face-down cards and expresses both sides of an exchange", () => {
    expect(TRUMP_CATALOG.return.conditions).toEqual([
      { kind: "hasFaceUp", target: "self" },
    ]);
    expect(TRUMP_CATALOG.remove.conditions).toEqual([
      { kind: "hasFaceUp", target: "opponent" },
    ]);
    expect(TRUMP_CATALOG.exchange.conditions).toEqual([
      { kind: "hasFaceUp", target: "self" },
      { kind: "hasFaceUp", target: "opponent" },
    ]);
    expect(TRUMP_CATALOG.return.onPlay[0].target).toBe("self");
    expect(TRUMP_CATALOG.remove.onPlay[0].target).toBe("opponent");
  });
  it("distinguishes mixed effects, defensive direction and target replacement", () => {
    const card = TRUMP_CATALOG["pressure-supply"];
    expect(card.onPlay).toEqual([
      { kind: "grantTrump", target: "self", count: 1 },
    ]);
    expect(card.table.effects).toEqual([{ kind: "winBonus", amount: 1 }]);
    expect(TRUMP_CATALOG.shield.table.effects).toEqual([
      { kind: "cancelOpponentBonusOnLoss", amount: 1 },
    ]);
    for (const id of ["target-17", "target-24", "target-27"] as const) {
      expect(TRUMP_CATALOG[id].table.stacking).toBe(
        "replace-global-point-target",
      );
      expect(TRUMP_CATALOG[id].table.effects[0].value).toBe(
        Number(id.slice(7)),
      );
    }
  });
  it("keeps resource costs, grant order and finite trigger charges explicit", () => {
    expect(TRUMP_CATALOG["resource-swap"].cost).toEqual({
      discardOtherHandCards: 1,
      selection: "owner-choice",
    });
    expect(TRUMP_CATALOG["resource-swap"].conditions).toEqual([
      { kind: "hasOtherHandCards", count: 1 },
    ]);
    expect(TRUMP_CATALOG["shared-supply"].onPlay.map((e) => e.target)).toEqual([
      "self",
      "opponent",
    ]);
    expect(TRUMP_CATALOG.harvest.table.effects[0]).toMatchObject({
      charges: 2,
      excludeSelf: true,
      grantDoesNotTrigger: true,
      leaveOnExhaustion: true,
    });
    expect(EXPERIMENTAL_F1_P0.resource.model).toBe(
      "finite-per-side-no-recycle",
    );
    expect(EXPERIMENTAL_F1_P0.playable).toBe(false);
  });
});
