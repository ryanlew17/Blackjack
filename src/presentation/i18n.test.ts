// @req REQ-2026-027: validate both dictionaries for all registered skill names and descriptions.
// @req REQ-2026-013/025
import { expect, it } from "vitest";
import { SKILL_CATALOG } from "../domain/contest/skills/catalog";
import { en, zh } from "./i18n";
import { TRUMP_CATALOG } from "../domain/contest/trumps/catalog";

it("provides both languages for every registered name and effect description", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  for (const card of [
    ...Object.values(TRUMP_CATALOG),
    ...Object.values(SKILL_CATALOG),
  ]) {
    for (const key of [card.nameKey, card.descriptionKey]) {
      expect(typeof en[key]).toBe("string");
      expect(en[key].trim().length).toBeGreaterThan(0);
      expect(zh[key].trim().length).toBeGreaterThan(0);
    }
  }
});
