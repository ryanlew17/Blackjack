// @req REQ-2026-027: production recovery shares the skill engine and actual undo deltas.
import { freezeData } from "../immutable";
import type { TrumpDefinition } from "../engine/effectTypes";
export const SKILL_TRUMP_DEFINITIONS = freezeData({
  "skill-revival": { onPlay: [{ type: "recover-skill-use" }] },
} satisfies Readonly<Record<string, TrumpDefinition>>);
