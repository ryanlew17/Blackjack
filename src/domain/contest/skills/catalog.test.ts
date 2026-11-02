// @req REQ-2026-027: exact registered contract, not a promise of runtime admission.
import { expect, it } from "vitest";
import { DIFFICULTIES } from "../types";
import {
  availableSkillIds,
  isSkillId,
  SKILL_CATALOG,
  SKILL_IDS,
} from "./catalog";
import { EXECUTABLE_SKILL_IDS } from "../engine/skills";

it("registers all fifteen exact five-difficulty allowances", () => {
  const expected = [
    [2, 3, 3, 4, 5],
    [2, 3, 3, 4, 5],
    [1, 2, 3, 4, 5],
    [1, 2, 3, 4, 5],
    [1, 2, 3, 4, 5],
    [0, 2, 2, 3, 4],
    [1, 2, 2, 3, 4],
    [1, 2, 2, 3, 4],
    [0, 1, 2, 3, 4],
    [0, 1, 2, 2, 3],
    [0, 0, 1, 2, 3],
    [0, 0, 1, 2, 3],
    [0, 0, 1, 2, 3],
    [0, 0, 0, 1, 2],
    [0, 0, 0, 0, 1],
  ];
  expect(SKILL_IDS).toHaveLength(15);
  expect(new Set(SKILL_IDS).size).toBe(15);
  expect(
    SKILL_IDS.map((id) =>
      DIFFICULTIES.map((d) => SKILL_CATALOG[id].usesPerMatch[d]),
    ),
  ).toEqual(expected);
  expect(EXECUTABLE_SKILL_IDS).toEqual([
    "spirit-sight",
    "pickpocket",
    "craft-gift",
    "fortune",
    "self-renewal",
    "tempt-fate",
    "frame",
    "scapegoat",
    "metamorphosis",
    "provoke",
    "mind-grip",
    "soul-transfer",
    "twin-bloom",
    "nullify",
    "endless-life",
  ]);
  expect(
    SKILL_IDS.filter((id) => SKILL_CATALOG[id].visibility === "secret"),
  ).toEqual(["metamorphosis", "soul-transfer", "twin-bloom"]);
  expect(
    SKILL_IDS.filter(
      (id) => SKILL_CATALOG[id].activationWindow === "opponent-reaction",
    ),
  ).toEqual(["twin-bloom"]);
  for (const id of SKILL_IDS) {
    expect(isSkillId(id)).toBe(true);
    expect(Object.isFrozen(SKILL_CATALOG[id])).toBe(true);
    expect(Object.isFrozen(SKILL_CATALOG[id].usesPerMatch)).toBe(true);
  }
  for (const bad of ["regret", "constructor", "__proto__", null, 0])
    expect(isSkillId(bad)).toBe(false);
});
it("derives 7/10/13/14/15 choices only for playable difficulties", () => {
  expect(
    DIFFICULTIES.map((d) => availableSkillIds(d, DIFFICULTIES).length),
  ).toEqual([7, 10, 13, 14, 15]);
  for (const d of DIFFICULTIES) {
    expect(availableSkillIds(d, [])).toEqual([]);
    expect(
      availableSkillIds(
        d,
        DIFFICULTIES.filter((x) => x !== d),
      ),
    ).toEqual([]);
    expect(
      availableSkillIds(d, [d]).every(
        (id) => SKILL_CATALOG[id].usesPerMatch[d] > 0,
      ),
    ).toBe(true);
  }
  expect(() => availableSkillIds("unknown" as never, [])).toThrow(RangeError);
  expect(() => availableSkillIds("standard", ["unknown" as never])).toThrow(
    RangeError,
  );
});
