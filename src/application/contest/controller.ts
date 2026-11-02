// @req REQ-2026-025: human commands and explicit S2 admission; authority remains private.
import { S2_DEVELOPMENT_PRESET } from "../../domain/contest/presets/s2";
import { createContestCoordinator } from "./coordinator";
import { sendContestInput } from "./input";
import { createContestRandomSources } from "./random";
import { freezeData } from "../../domain/contest/immutable";
import {
  availableSkillIds,
  SKILL_CATALOG,
  type SkillId,
} from "../../domain/contest/skills/catalog";
import { selectMatchSkills } from "../../domain/contest/skills/selection";
import {
  resourceRandom,
  skillRandom,
} from "../../domain/contest/engine/resourceTypes";
import type {
  ContestInput,
  ContestControllerOptions,
  ContestPreparation,
} from "./types";

export function createContestController(
  options: ContestControllerOptions = {},
) {
  const { preset, prepareSkills = false, ...ports } = options;
  if (prepareSkills && preset === "standard-no-trumps")
    throw new RangeError("Skill preparation requires the S2 trump preset");
  const random =
    ports.random ?? (prepareSkills ? createContestRandomSources() : undefined);
  const skillSources = prepareSkills ? skillRandom(random!) : undefined;
  if (prepareSkills) {
    resourceRandom(random);
    if (typeof random === "function" || typeof random?.numbers !== "function")
      throw new RangeError("Missing number random source");
  }
  const { sendCommand, ...controls } = createContestCoordinator({
    ...ports,
    random,
    ...(preset === "s2-development" || prepareSkills
      ? { roundRules: S2_DEVELOPMENT_PRESET.round }
      : {}),
  });
  let preparation: ContestPreparation | null = null;
  let preparationId = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const closePreparation = () => {
    preparationId++;
    preparation = null;
  };
  function openPreparation() {
    if (preparation || controls.snapshot()) return false;
    preparation = freezeData({
      inputId: ++preparationId,
      difficulty: "standard" as const,
      paused: false,
      selected: null,
      options: availableSkillIds("standard", ["standard"]).map((id) => ({
        id,
        nameKey: SKILL_CATALOG[id].nameKey,
        descriptionKey: SKILL_CATALOG[id].descriptionKey,
        initialUses: SKILL_CATALOG[id].usesPerMatch.standard,
      })),
    });
    notify();
    return true;
  }
  return {
    ...controls,
    getPreparationSnapshot: () => preparation,
    subscribePreparation(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      return prepareSkills ? openPreparation() : controls.start();
    },
    restart() {
      if (!prepareSkills) return controls.restart();
      closePreparation();
      controls.exit();
      openPreparation();
    },
    exit() {
      closePreparation();
      controls.exit();
      notify();
    },
    pause() {
      if (!preparation) return controls.pause();
      if (preparation.paused) return;
      preparation = freezeData({
        ...preparation,
        paused: true,
        inputId: ++preparationId,
      });
      notify();
    },
    resume() {
      if (!preparation) return controls.resume();
      if (!preparation.paused) return;
      preparation = freezeData({
        ...preparation,
        paused: false,
        inputId: ++preparationId,
      });
      notify();
    },
    skipAnimations() {
      if (!preparation) return controls.skipAnimations();
      preparation = freezeData({ ...preparation, inputId: ++preparationId });
      notify();
    },
    selectSkill(id: SkillId, inputId: number) {
      if (
        !preparation ||
        preparation.paused ||
        preparation.inputId !== inputId ||
        !preparation.options.some((option) => option.id === id)
      )
        return false;
      if (preparation.selected === id) return true;
      preparation = freezeData({
        ...preparation,
        selected: id,
        inputId: ++preparationId,
      });
      notify();
      return true;
    },
    cancelSkillSelection(inputId: number) {
      if (!preparation || preparation.inputId !== inputId) return false;
      closePreparation();
      notify();
      return true;
    },
    confirmSkill(inputId: number) {
      if (
        !preparation ||
        preparation.paused ||
        preparation.inputId !== inputId ||
        !preparation.selected ||
        controls.snapshot()
      )
        return false;
      const human = preparation.selected;
      closePreparation();
      const id = preparationId;
      try {
        const skills = selectMatchSkills(
          "standard",
          ["standard"],
          human,
          skillSources!.skillSelection,
        );
        if (id !== preparationId) return false;
        return controls.start({ ...S2_DEVELOPMENT_PRESET.round, skills });
      } finally {
        notify();
      }
    },
    send(action: ContestInput) {
      return sendContestInput(action, controls.getSnapshot(), sendCommand);
    },
  };
}
