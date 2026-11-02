// @req REQ-2026-027: actual controller initialization, independent random counters and cancelled generations.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestController } from "./controller";
import {
  availableSkillIds,
  SKILL_CATALOG,
} from "../../domain/contest/skills/catalog";
function setup(sample = 0) {
  const random = {
    numbers: vi.fn(() => 0.25),
    trumpGate: vi.fn(() => 0.99),
    trumpSelection: vi.fn(() => 0),
    skillSelection: vi.fn(() => sample),
    skillEffects: vi.fn(() => 0),
  };
  const api = createContestController({ prepareSkills: true, random });
  const choose = (id = availableSkillIds("standard", ["standard"])[0]) => {
    expect(api.selectSkill(id, api.getPreparationSnapshot()!.inputId)).toBe(
      true,
    );
    return api.getPreparationSnapshot()!.inputId;
  };
  return { api, random, choose };
}
const noRandom = (random: ReturnType<typeof setup>["random"]) => {
  for (const source of Object.values(random))
    expect(source).not.toHaveBeenCalled();
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
it("opens ten descriptions without a match, requires a valid choice, and cancels with zero randomness", () => {
  const { api, random, choose } = setup();
  expect(api.getPreparationSnapshot()).toBeNull();
  expect(api.start()).toBe(true);
  const open = api.getPreparationSnapshot()!;
  expect(open.options).toHaveLength(10);
  expect(open.selected).toBeNull();
  for (const option of open.options) {
    expect(option.nameKey).toBe(SKILL_CATALOG[option.id].nameKey);
    expect(option.descriptionKey).toBe(SKILL_CATALOG[option.id].descriptionKey);
    expect(option.initialUses).toBe(
      SKILL_CATALOG[option.id].usesPerMatch.standard,
    );
  }
  expect(api.start()).toBe(false);
  expect(api.confirmSkill(open.inputId)).toBe(false);
  expect(api.selectSkill("nullify", open.inputId)).toBe(false);
  expect(api.selectSkill("" as never, open.inputId)).toBe(false);
  const token = choose();
  expect(api.confirmSkill(open.inputId)).toBe(false);
  expect(api.cancelSkillSelection(token)).toBe(true);
  expect(api.snapshot()).toBeNull();
  expect(api.getPreparationSnapshot()).toBeNull();
  expect(api.confirmSkill(token)).toBe(false);
  noRandom(random);
  expect(vi.getTimerCount()).toBe(0);
  api.start();
  expect(api.selectSkill("pickpocket", token)).toBe(false);
  api.exit();
  noRandom(random);
});
it.each(Array.from({ length: 10 }, (_, n) => n))(
  "chooses AI interval %s once at confirmation, after any human preview changes",
  (index) => {
    const { api, random, choose } = setup((index + 0.5) / 10);
    api.start();
    for (const id of availableSkillIds("standard", ["standard"])) choose(id);
    noRandom(random);
    const token = choose("spirit-sight");
    expect(api.confirmSkill(token)).toBe(true);
    const committed = api.snapshot()!;
    expect(committed.rules.round.skills!.selected).toEqual({
      human: "spirit-sight",
      ai: availableSkillIds("standard", ["standard"])[index],
    });
    expect(api.getPreparationSnapshot()).toBeNull();
    expect(api.confirmSkill(token)).toBe(false);
    expect(api.start()).toBe(false);
    expect(random.skillSelection).toHaveBeenCalledTimes(1);
    expect(random.numbers).toHaveBeenCalledTimes(11);
    expect(random.trumpSelection).toHaveBeenCalledTimes(6);
    expect(random.trumpGate).not.toHaveBeenCalled();
    expect(random.skillEffects).not.toHaveBeenCalled();
    expect(Object.isFrozen(committed.rules.round.skills!.selected)).toBe(true);
    expect(committed.round.skills!.human.initialUses).toBe(2);
    expect(committed.round.skills!.ai.initialUses).toBe(
      SKILL_CATALOG[committed.round.skills!.ai.id].usesPerMatch.standard,
    );
    api.pause();
    api.resume();
    api.skipAnimations();
    vi.runAllTimers();
    expect(random.skillSelection).toHaveBeenCalledTimes(1);
    api.exit();
  },
);
it("pauses preparation and expires old confirm/cancel/visibility tokens without sampling", () => {
  const { api, random, choose } = setup();
  api.start();
  const old = choose();
  api.pause();
  const paused = api.getPreparationSnapshot()!;
  expect(paused.paused).toBe(true);
  expect(api.confirmSkill(paused.inputId)).toBe(false);
  expect(api.selectSkill("fortune", paused.inputId)).toBe(false);
  api.resume();
  expect(api.confirmSkill(old)).toBe(false);
  const fresh = api.getPreparationSnapshot()!.inputId;
  api.skipAnimations();
  expect(api.cancelSkillSelection(fresh)).toBe(false);
  noRandom(random);
  api.exit();
});
it("restarts into an empty selection, discards an old replay, and chooses again only for a confirmed new match", () => {
  const { api, random, choose } = setup();
  api.start();
  const token = choose();
  api.confirmSkill(token);
  api.restart();
  expect(api.snapshot()).toBeNull();
  expect(api.getPreparationSnapshot()!.selected).toBeNull();
  vi.runAllTimers();
  expect(api.snapshot()).toBeNull();
  expect(api.confirmSkill(token)).toBe(false);
  const next = choose("fortune");
  api.cancelSkillSelection(next);
  expect(random.skillSelection).toHaveBeenCalledTimes(1);
  api.start();
  expect(api.confirmSkill(choose("spirit-sight"))).toBe(true);
  expect(random.skillSelection).toHaveBeenCalledTimes(2);
  api.exit();
});
it("consumes a confirm token before a reentrant random callback and does not start after cancellation", () => {
  const { api, random, choose } = setup();
  api.start();
  const token = choose();
  random.skillSelection.mockImplementation(() => {
    expect(api.confirmSkill(token)).toBe(false);
    api.exit();
    return 0;
  });
  expect(api.confirmSkill(token)).toBe(false);
  expect(api.snapshot()).toBeNull();
  expect(random.numbers).not.toHaveBeenCalled();
  expect(random.skillSelection).toHaveBeenCalledTimes(1);
});
it("rejects insufficient skill/random ports before constructing a selection or consuming numbers", () => {
  const numbers = vi.fn(() => 0);
  expect(() =>
    createContestController({ prepareSkills: true, random: numbers }),
  ).toThrow();
  expect(() =>
    createContestController({
      prepareSkills: true,
      preset: "standard-no-trumps",
    }),
  ).toThrow();
  expect(numbers).not.toHaveBeenCalled();
});
