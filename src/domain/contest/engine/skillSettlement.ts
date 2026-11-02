// @req REQ-2026-027: one ordered settlement pipeline, never an animation callback.
import { freezeData } from "../immutable";
import type { PlayerId, NumberValue } from "../types";
import { contribution, effectiveTotals, numberValue } from "./contributions";
import { randomUnit } from "./numbers";
import { opponentOf } from "./turn";
import { pendingSkills, updateSkillActivation } from "./skills";
import type { SkillActivation, SkillActivationStatus } from "./skillTypes";
import type { SkillRandomSources } from "./resourceTypes";
import type { RoundState, RoundEvent, RoundTransition } from "./types";

type Pending = { player: PlayerId; activation: SkillActivation };
function resolve(
  original: RoundState,
  pending: Pending,
  status: SkillActivationStatus,
): RoundState {
  return updateSkillActivation(
    original,
    pending.player,
    pending.activation.sequence,
    { public: true, status },
  );
}
export function settleRoundSkills(
  original: RoundState,
  random?: Partial<SkillRandomSources>,
): RoundTransition & {
  readonly totals: Readonly<Record<PlayerId, number>>;
} {
  let state = original;
  const events: RoundEvent[] = [];
  const pending = pendingSkills(state);
  const emit = (
    entry: Pending,
    status: SkillActivationStatus,
    amount?: number,
  ) => {
    events.push({
      type: "skill",
      player: entry.player,
      skillId: state.rules.skills!.selected[entry.player],
      public: true,
      status,
      ...(amount !== undefined ? { amount } : {}),
      state,
    });
  };
  // All Metamorphoses precede contribution/multiplier/symbiosis evaluation.
  for (const entry of pending.filter(
    (p) => p.activation.effect!.type === "metamorphosis",
  )) {
    const values: Record<string, NumberValue> = { ...state.settlementValues };
    let changed = false;
    for (const player of [state.firstPlayer, opponentOf(state.firstPlayer)]) {
      for (const card of state.hands[player])
        if (numberValue(state, card) === 1) {
          values[card.instanceId] = (2 +
            Math.floor(randomUnit(random?.skillEffects!) * 10)) as NumberValue;
          changed = true;
        }
    }
    if (changed) state = freezeData({ ...state, settlementValues: values });
    const status = changed ? "succeeded" : "ineffective";
    state = resolve(state, entry, status);
    emit(entry, status);
  }
  // Snapshot both effective hidden-slot values before symbiosis combines contributions.
  const hidden = (player: PlayerId) =>
    contribution(
      state,
      player,
      state.hands[player].find(
        (c) => c.instanceId === state.hiddenCards[player],
      )!,
    );
  const hiddenValues = { human: hidden("human"), ai: hidden("ai") };
  const totals = {
    ...(state.settlementTotals ?? effectiveTotals(state, true)),
  };
  for (const entry of pending.filter((p) => {
    const effect = p.activation.effect!;
    return (
      ["tempt-fate", "frame", "scapegoat"].includes(effect.type) ||
      (effect.type === "provoke" && effect.phase === "penalty")
    );
  })) {
    const effect = entry.activation.effect!;
    const target =
      effect.type === "frame" || effect.type === "provoke"
        ? opponentOf(entry.player)
        : entry.player;
    const upper =
      effect.type === "scapegoat"
        ? effect.value + 1
        : hiddenValues[
            effect.type === "frame" ? entry.player : opponentOf(entry.player)
          ] + 1;
    const amount =
      effect.type === "provoke"
        ? 99
        : (effect.type === "scapegoat" ? -1 : 1) *
          (1 + Math.floor(randomUnit(random?.skillEffects!) * upper));
    totals[target] += amount;
    state = freezeData({
      ...state,
      settlementTotals: {
        human: Math.max(0, totals.human),
        ai: Math.max(0, totals.ai),
      },
    });
    state = resolve(state, entry, "succeeded");
    emit(entry, "succeeded", amount);
  }
  return freezeData({
    state,
    events,
    totals: { human: Math.max(0, totals.human), ai: Math.max(0, totals.ai) },
  });
}
/** Both qualifying rules point at the resolved Round loser; ties and other effects do not override. */
export function skillFirstPlayer(round: RoundState): PlayerId | undefined {
  const winner = round.result?.winner;
  if (!winner) return undefined;
  const qualifies = (["human", "ai"] as const).some((player) =>
    round.skills?.players[player].activations.some(
      (a) =>
        a.roundNumber === round.numberScope &&
        a.status === "succeeded" &&
        ((a.effect?.type === "tempt-fate" && player !== winner) ||
          (a.effect?.type === "frame" && player === winner)),
    ),
  );
  return qualifies ? opponentOf(winner) : undefined;
}
