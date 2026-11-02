// @req REQ-2026-027: every difficulty uses the full available set once, without counter-selection.
import { expect, it, vi } from "vitest";
import { selectMatchSkills } from "./selection";
import { availableSkillIds } from "./catalog";
import { DIFFICULTIES } from "../types";
import { createMatch, observeMatch } from "../engine";
import { S2_DEVELOPMENT_PRESET } from "../presets/s2";
import { createResourcePreset } from "../presets/resources";
import { ADMITTED_TRUMP_IDS } from "../trumps/admitted";

it.each(DIFFICULTIES)(
  "selects each available %s skill at equal interval endpoints, including the player's skill",
  (difficulty) => {
    const available = availableSkillIds(difficulty, [difficulty]);
    expect(available.length).toBe(
      [7, 10, 13, 14, 15][DIFFICULTIES.indexOf(difficulty)],
    );
    for (const [index, expected] of available.entries()) {
      for (const sample of [
        index / available.length,
        (index + 0.999) / available.length,
      ]) {
        const random = vi.fn(() => sample);
        const a = selectMatchSkills(
          difficulty,
          [difficulty],
          available[0],
          random,
        );
        const b = selectMatchSkills(
          difficulty,
          [difficulty],
          available.at(-1)!,
          () => sample,
        );
        expect(a.selected.ai).toBe(expected);
        expect(b.selected.ai).toBe(expected);
        expect(random).toHaveBeenCalledTimes(1);
        expect(Object.isFrozen(a.selected)).toBe(true);
      }
      const skills = selectMatchSkills(
        difficulty,
        [difficulty],
        expected,
        () => index / available.length,
      );
      const effects = vi.fn(() => 0),
        selection = vi.fn(() => 0);
      const match = createMatch(
        {
          numbers: () => 0.25,
          trumpGate: () => 0.99,
          trumpSelection: () => 0,
          skillSelection: selection,
          skillEffects: effects,
        },
        {
          ...S2_DEVELOPMENT_PRESET.round,
          skills,
          trumps: {
            ...S2_DEVELOPMENT_PRESET.round.trumps!,
            resources: createResourcePreset(difficulty, ADMITTED_TRUMP_IDS),
          },
        },
      ).state;
      expect(match.rules.round.skills!.selected).toEqual({
        human: expected,
        ai: expected,
      });
      const view = observeMatch(match, "human").round.skills!;
      expect(view.human.id).toBe(expected);
      expect(view.ai.id).toBe(expected);
      expect(view.human.initialUses).toBe(view.ai.initialUses);
      expect(selection).not.toHaveBeenCalled();
      expect(effects).not.toHaveBeenCalled();
    }
  },
);
it("rejects empty, unavailable, zero-use and locked choices before sampling", () => {
  const random = vi.fn(() => 0);
  for (const run of [
    () => selectMatchSkills("standard", ["standard"], "" as never, random),
    () => selectMatchSkills("standard", ["standard"], "nullify", random),
    () => selectMatchSkills("standard", ["easy"], "pickpocket", random),
  ])
    expect(run).toThrow(RangeError);
  expect(random).not.toHaveBeenCalled();
});
it.each([-0.1, 1, NaN, Infinity])(
  "rejects invalid selection sample %s without producing rules",
  (sample) => {
    expect(() =>
      selectMatchSkills("standard", ["standard"], "pickpocket", () => sample),
    ).toThrow(RangeError);
  },
);
