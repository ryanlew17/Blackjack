// @req REQ-2026-027: one uniform definition choice per available recurring generation, independent of stock.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { randomUnit } from "./numbers";
import { generateTrump } from "./resources";
import { updateSkillActivation } from "./skills";
import type { SkillRandomSources } from "./resourceTypes";
import type { RoundState, RoundTransition, RoundEvent } from "./types";

export function tickEndlessLife(
  original: RoundState,
  player: PlayerId,
  sequence: number,
  random?: Partial<SkillRandomSources>,
): RoundTransition {
  let state = original;
  const activation = state.skills!.players[player].activations.find(
    (a) => a.sequence === sequence,
  )!;
  let instance: import("./effectTypes").TrumpInstance | null = null;
  if (
    state.trumps!.hands[player].length <
    state.rules.trumps!.resources!.handLimit
  ) {
    const pool = Object.entries(state.rules.trumps!.resources!.stock)
      .filter(([, count]) => count > 0)
      .map(([id]) => id);
    const definitionId =
      pool[Math.floor(randomUnit(random?.skillEffects!) * pool.length)];
    const generated = generateTrump(
      state.trumps!,
      player,
      definitionId,
      "skill:endless-life:" + player + ":game-" + state.trumps!.game,
      state.rules.trumps!,
      "hand",
      "endless-life",
    );
    instance = generated.instance;
    state = freezeData({ ...state, trumps: generated.state });
  }
  if (instance && activation.status !== "succeeded")
    state = updateSkillActivation(state, player, sequence, {
      status: "succeeded",
    });
  const events: RoundEvent[] = [
    {
      type: "resource",
      operation: "generate",
      cause: "trigger",
      player,
      instance,
      public: false,
      state,
    },
  ];
  if (instance && activation.status !== "succeeded")
    events.push({
      type: "skill",
      player,
      skillId: "endless-life",
      public: true,
      status: "succeeded",
      state,
    });
  return freezeData({ state, events });
}
