// @req REQ-2026-027: close a watched Turn using actual trump consumption, before handover/settlement.
import { freezeData } from "../immutable";
import { pendingSkills, updateSkillActivation } from "./skills";
import type {
  RoundState,
  RoundEvent,
  RoundTransition,
  TurnState,
} from "./types";

export function finishTurnSkills(
  original: RoundState,
  turn: TurnState,
): RoundTransition {
  let state = original;
  const events: RoundEvent[] = [];
  for (const entry of pendingSkills(state)) {
    const effect = entry.activation.effect!;
    if (
      effect.type !== "provoke" ||
      effect.phase !== "watching" ||
      effect.targetTurn !== turn.number
    )
      continue;
    const status = turn.usedTrump ? "ineffective" : "prepared";
    state = updateSkillActivation(
      state,
      entry.player,
      entry.activation.sequence,
      {
        status,
        effect: turn.usedTrump ? effect : { ...effect, phase: "penalty" },
      },
    );
    events.push({
      type: "skill",
      player: entry.player,
      skillId: "provoke",
      public: true,
      status,
      state,
    });
  }
  return freezeData({ state, events });
}
