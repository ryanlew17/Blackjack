// @req REQ-2026-027: one uniform AI selection, independent of the player's chosen identity.
import { freezeData } from "../immutable";
import { randomUnit, type RandomSource } from "../engine/numbers";
import type { SkillRules } from "../engine/skillTypes";
import type { Difficulty } from "../types";
import { availableSkillIds, type SkillId } from "./catalog";

export function selectMatchSkills(
  difficulty: Difficulty,
  playableDifficulties: readonly Difficulty[],
  human: SkillId,
  random: RandomSource,
): SkillRules {
  const available = availableSkillIds(difficulty, playableDifficulties);
  if (!available.includes(human))
    throw new RangeError("Selected skill is unavailable");
  const ai = available[Math.floor(randomUnit(random) * available.length)];
  return freezeData({
    difficulty,
    playableDifficulties: [...playableDifficulties],
    selected: { human, ai },
  });
}
