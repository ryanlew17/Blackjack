// @req REQ-2026-027: reverse available recovery credits without rewinding spent activations or secret knowledge.
import { freezeData } from "../immutable";
import { SKILL_CATALOG } from "../skills/catalog";
import type { PlayerId } from "../types";
import { SKILL_USE_RECOVERY } from "./effectTypes";
import type { Mutation } from "./effectOperations";
import type { RoundState } from "./types";

export function changeSkillRecovery(
  original: RoundState,
  player: PlayerId,
  change: { uses: number; permission: number; publicUses: number },
): Mutation {
  const runtime = original.skills!.players[player],
    rules = original.rules.skills!;
  const cap =
    SKILL_CATALOG[rules.selected[player]].usesPerMatch[rules.difficulty];
  const clamp = (n: number) => Math.min(cap, Math.max(0, n));
  const remainingUses = clamp(runtime.remainingUses + change.uses);
  const publicRemainingUses = clamp(
    runtime.publicRemainingUses + change.publicUses,
  );
  const gameActivationsRemaining = Math.max(
    0,
    runtime.gameActivationsRemaining + change.permission,
  );
  return {
    state: freezeData({
      ...original,
      skills: {
        ...original.skills!,
        players: {
          ...original.skills!.players,
          [player]: {
            ...runtime,
            remainingUses,
            publicRemainingUses,
            gameActivationsRemaining,
          },
        },
      },
    }),
    deltas: [
      {
        type: "skill-recovery",
        player,
        uses: remainingUses - runtime.remainingUses,
        permission: gameActivationsRemaining - runtime.gameActivationsRemaining,
        publicUses: publicRemainingUses - runtime.publicRemainingUses,
      },
    ],
  };
}
export function recoverSkillUse(state: RoundState, player: PlayerId): Mutation {
  return changeSkillRecovery(state, player, {
    uses: SKILL_USE_RECOVERY.uses,
    permission: SKILL_USE_RECOVERY.additionalGameActivations,
    publicUses: SKILL_USE_RECOVERY.uses,
  });
}
