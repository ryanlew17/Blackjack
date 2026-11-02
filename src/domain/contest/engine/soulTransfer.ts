// @req REQ-2026-027: one original PlayTrump is intercepted once; the skill reward is not a card-effect delta.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { pendingSkills, updateSkillActivation } from "./skills";
import { generateTrump } from "./resources";
import type { RoundState, RoundEvent, RoundTransition } from "./types";

export function interceptTrump(
  original: RoundState,
  player: PlayerId,
): RoundTransition & { readonly effectPlayer: PlayerId } {
  const entry = pendingSkills(original).find(
    (p) => p.player !== player && p.activation.effect?.type === "soul-transfer",
  );
  if (!entry) return { state: original, events: [], effectPlayer: player };
  let state = updateSkillActivation(
    original,
    entry.player,
    entry.activation.sequence,
    { public: true, status: "succeeded" },
  );
  const events: RoundEvent[] = [
    {
      type: "skill",
      player: entry.player,
      skillId: "soul-transfer",
      public: true,
      status: "succeeded",
      state,
    },
  ];
  const generated = generateTrump(
    state.trumps!,
    entry.player,
    "regret",
    "skill:soul-transfer:" + entry.player + ":round-" + state.numberScope,
    state.rules.trumps!,
  );
  state = freezeData({ ...state, trumps: generated.state });
  events.push({
    type: "resource",
    player: entry.player,
    operation: "generate",
    cause: "effect",
    instance: generated.instance,
    public: false,
    state,
  });
  return freezeData({ state, events, effectPlayer: entry.player });
}
