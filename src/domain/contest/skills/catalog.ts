// @req REQ-2026-027: registered identities and difficulty eligibility are not execution admission.
import { freezeData } from "../immutable";
import { DIFFICULTIES, type Difficulty } from "../types";

export const SKILL_IDS = Object.freeze([
  "pickpocket",
  "tempt-fate",
  "scapegoat",
  "craft-gift",
  "metamorphosis",
  "frame",
  "fortune",
  "spirit-sight",
  "provoke",
  "soul-transfer",
  "nullify",
  "self-renewal",
  "twin-bloom",
  "mind-grip",
  "endless-life",
] as const);
export type SkillId = (typeof SKILL_IDS)[number];
export type SkillTextKey = `contest.skill.${SkillId}.${"name" | "description"}`;
export interface SkillDefinition {
  readonly id: SkillId;
  readonly nameKey: SkillTextKey;
  readonly descriptionKey: SkillTextKey;
  readonly visibility: "public" | "secret";
  readonly activationWindow: "own-turn" | "opponent-reaction";
  readonly usesPerMatch: Readonly<Record<Difficulty, number>>;
}
const uses: Readonly<
  Record<SkillId, readonly [number, number, number, number, number]>
> = {
  pickpocket: [2, 3, 3, 4, 5],
  "tempt-fate": [2, 3, 3, 4, 5],
  scapegoat: [1, 2, 3, 4, 5],
  "craft-gift": [1, 2, 3, 4, 5],
  metamorphosis: [1, 2, 3, 4, 5],
  frame: [0, 2, 2, 3, 4],
  fortune: [1, 2, 2, 3, 4],
  "spirit-sight": [1, 2, 2, 3, 4],
  provoke: [0, 1, 2, 3, 4],
  "soul-transfer": [0, 1, 2, 2, 3],
  nullify: [0, 0, 1, 2, 3],
  "self-renewal": [0, 0, 1, 2, 3],
  "twin-bloom": [0, 0, 1, 2, 3],
  "mind-grip": [0, 0, 0, 1, 2],
  "endless-life": [0, 0, 0, 0, 1],
};
export const SKILL_CATALOG: Readonly<Record<SkillId, SkillDefinition>> =
  freezeData(
    Object.fromEntries(
      SKILL_IDS.map((id) => [
        id,
        {
          id,
          nameKey: `contest.skill.${id}.name`,
          descriptionKey: `contest.skill.${id}.description`,
          visibility: ["metamorphosis", "soul-transfer", "twin-bloom"].includes(
            id,
          )
            ? "secret"
            : "public",
          activationWindow:
            id === "twin-bloom" ? "opponent-reaction" : "own-turn",
          usesPerMatch: Object.fromEntries(
            DIFFICULTIES.map((difficulty, index) => [
              difficulty,
              uses[id][index],
            ]),
          ),
        },
      ]),
    ) as Record<SkillId, SkillDefinition>,
  );
export function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" && Object.hasOwn(SKILL_CATALOG, value);
}
/** S3 supplies playable difficulties from its unlock chain; no separate skill progress. */
export function availableSkillIds(
  difficulty: Difficulty,
  playableDifficulties: readonly Difficulty[],
): readonly SkillId[] {
  if (
    !DIFFICULTIES.includes(difficulty) ||
    !Array.isArray(playableDifficulties) ||
    playableDifficulties.some((d) => !DIFFICULTIES.includes(d))
  )
    throw new RangeError("Invalid skill difficulty eligibility");
  return Object.freeze(
    playableDifficulties.includes(difficulty)
      ? SKILL_IDS.filter((id) => SKILL_CATALOG[id].usesPerMatch[difficulty] > 0)
      : [],
  );
}
