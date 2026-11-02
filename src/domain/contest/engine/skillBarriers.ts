// @req REQ-2026-027: Game disable regardless of secrecy and inclusive three-Round stock/activation seal.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { deleteTrump } from "./resources";
import { opponentOf } from "./turn";
import type { SkillState } from "./skillTypes";
import type { TrumpInstance } from "./effectTypes";
import type { RoundState, RoundTransition, RoundEvent } from "./types";

export function isNullifyImmune(card: TrumpInstance): boolean {
  return (
    card.origin.type === "generated" && card.origin.skillId === "endless-life"
  );
}
export function resolveNullify(
  original: RoundState,
  player: PlayerId,
): RoundTransition {
  const other = opponentOf(player),
    runtime = original.skills!.players[other];
  const immune = original.rules.skills!.selected[other] === "endless-life";
  const cancelled = immune
    ? []
    : runtime.activations.filter((a) => a.status === "prepared");
  let state: RoundState = freezeData({
    ...original,
    lastPlay: null,
    skills: {
      ...original.skills!,
      seal: { throughRound: original.numberScope + 2 },
      players: {
        ...original.skills!.players,
        [other]: {
          ...runtime,
          ...(!immune ? { disabled: true as const } : {}),
          activations: runtime.activations.map((a) =>
            cancelled.includes(a) ? { ...a, status: "cancelled" as const } : a,
          ),
        },
      },
    },
  });
  // Publish the seal and opposing lock together before replaying individual deletions.
  const events: RoundEvent[] = [
    {
      type: "skill",
      player,
      skillId: "nullify",
      public: true,
      status: "prepared",
      state,
    },
    ...cancelled.map((a) => ({
      type: "skill" as const,
      player: other,
      skillId: original.rules.skills!.selected[other],
      public: a.public,
      status: "cancelled" as const,
      state,
    })),
  ];
  for (const owner of [player, other])
    for (const instance of [...(state.trumps?.hands[owner] ?? [])]) {
      if (isNullifyImmune(instance)) continue;
      state = freezeData({
        ...state,
        trumps: deleteTrump(state.trumps!, owner, instance.instanceId),
      });
      events.push({
        type: "resource",
        operation: "delete",
        cause: "effect",
        player: owner,
        instance,
        public: false,
        state,
      });
    }
  return freezeData({ state, events });
}
/** Neither the public seal, Game disable nor a recurring generator survives Game cleanup. */
export function cleanupSkillGame(skills: SkillState): SkillState {
  const { seal: _seal, ...rest } = skills;
  const player = (id: PlayerId) => {
    const { disabled: _disabled, ...runtime } = skills.players[id];
    return {
      ...runtime,
      activations: runtime.activations.map((a) => {
        if (a.effect?.type !== "endless-life") return a;
        const { effect: _effect, ...history } = a;
        return {
          ...history,
          status: a.status === "prepared" ? ("expired" as const) : a.status,
        };
      }),
    };
  };
  return freezeData({
    ...rest,
    players: { human: player("human"), ai: player("ai") },
  });
}
