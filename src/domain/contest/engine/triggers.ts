// @req REQ-2026-027: idempotent Turn-start expiry, ordered supply and takeover arming.
// @req REQ-2026-024: one finite pass per consumption/boundary; grants never enqueue plays.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import type { TableEffect } from "./effectTypes";
import type { EffectDelta } from "./numberCards";
import type {
  ResourceRandomSources,
  SkillRandomSources,
} from "./resourceTypes";
import type {
  RoundEvent,
  RoundState,
  RoundTransition,
  TurnState,
} from "./types";
import { removeEffect, updateEffect } from "./effectOperations";
import type { EffectRecorder, Mutation } from "./effectOperations";
import { grantTrumps } from "./resources";
import { isEffectActive } from "./tableEffects";
import { pendingSkills, updateSkillActivation } from "./skills";
import type { SkillActivation } from "./skillTypes";
import { tickEndlessLife } from "./endlessLife";
import { resolveTwinBloom } from "./twinBloom";
import { opponentOf } from "./turn";
export interface TriggerTransition extends RoundTransition {
  readonly deltas: readonly EffectDelta[];
}

export function respondToPlay(
  original: RoundState,
  player: PlayerId,
  definitionId: string,
  before: readonly TableEffect[],
  random?: ResourceRandomSources,
  recordDeltas?: EffectRecorder,
): TriggerTransition {
  let state = original;
  const events: RoundEvent[] = [],
    deltas: EffectDelta[] = [];
  const apply = (mutation: Mutation) => {
    deltas.push(...mutation.deltas);
    state = recordDeltas?.(mutation.state, mutation.deltas) ?? mutation.state;
  };
  for (const prior of before) {
    const record = state.trumps!.table.find(
      (t) => t.effectId === prior.effectId,
    );
    if (
      !record ||
      !isEffectActive(prior, before) ||
      !isEffectActive(record, state.trumps!.table)
    )
      continue;
    if (
      record.kind === "harvest" &&
      prior.owner === player &&
      record.owner === player &&
      (record.remainingCharges ?? 0) > 0
    ) {
      const updated = updateEffect(state, {
        ...record,
        remainingCharges: record.remainingCharges! - 1,
      });
      apply(updated);
      events.push({
        type: "table-effect",
        operation: "updated",
        effectId: record.effectId,
        state,
      });
      const grant = grantTrumps(
        state,
        record.owner,
        1,
        "trigger",
        random?.trumpSelection,
        undefined,
        undefined,
        recordDeltas,
      );
      state = grant.state;
      events.push(...grant.events);
      deltas.push(...grant.deltas);
      if (record.remainingCharges === 1) {
        const removed = removeEffect(state, record.effectId);
        apply(removed);
        for (const d of removed.deltas)
          if (d.type === "effect-removed")
            events.push({
              type: "table-effect",
              operation: "removed",
              effectId: d.effectId,
              state,
            });
      }
    } else if (
      record.kind === "bandwagon" &&
      record.owner !== player &&
      record.watchedTurn === state.turn?.number &&
      !record.copiedDefinitionId
    ) {
      const updated = updateEffect(state, {
        ...record,
        copiedDefinitionId: definitionId,
      });
      apply(updated);
      events.push({
        type: "table-effect",
        operation: "updated",
        effectId: record.effectId,
        state,
      });
    }
  }
  return freezeData({ state, events, deltas });
}

/** Expire locks, process this Turn's one-shot pending records, then expose commands. */
export function beginTurn(
  original: RoundState,
  turn: TurnState,
  random?: ResourceRandomSources & Partial<SkillRandomSources>,
): RoundTransition {
  if (
    original.phase !== "acting" ||
    original.turn?.number !== turn.number ||
    original.turn.player !== turn.player ||
    (original.startedTurnNumber ?? 0) >= turn.number
  )
    return { state: original, events: [] };
  let state: RoundState = { ...original, turn, startedTurnNumber: turn.number };
  const events: RoundEvent[] = [];
  // @req REQ-2026-026: the boundary itself closes the old transaction, even for an unrelated lock.
  const closeUndoWindow = () => {
    if (state.lastPlay?.type !== "trump") return;
    state = { ...state, lastPlay: null };
    events.push({
      type: "undo-window-closed",
      reason: "turn-boundary",
      state: freezeData(state),
    });
  };
  const remove = (id: string) => {
    const removed = removeEffect(state, id);
    state = removed.state;
    closeUndoWindow();
    for (const d of removed.deltas)
      if (d.type === "effect-removed")
        events.push({
          type: "table-effect",
          operation: "removed",
          effectId: d.effectId,
          state: freezeData(state),
        });
  };
  for (const record of [...(state.trumps?.table ?? [])])
    if (
      record.expiresAfterTurn !== undefined &&
      record.expiresAfterTurn < turn.number
    )
      remove(record.effectId);
  type Pending = { sequence: number; player: PlayerId } & (
    | { kind: "bandwagon"; effectId: string }
    | { kind: "skill"; activation: SkillActivation }
  );
  const pending: Pending[] = (state.trumps?.table ?? []).flatMap(
    (record, index) =>
      record.kind === "bandwagon" &&
      record.watchedTurn! < turn.number &&
      record.owner === turn.player
        ? [
            {
              kind: "bandwagon" as const,
              player: record.owner,
              sequence: record.activationSequence ?? index,
              effectId: record.effectId,
            },
          ]
        : [],
  );
  for (const entry of pendingSkills(state)) {
    const effect = entry.activation.effect!;
    if (effect.type === "endless-life") {
      if (
        entry.player === turn.player &&
        (entry.activation.roundNumber < state.numberScope ||
          effect.targetTurn <= turn.number)
      )
        pending.push({
          kind: "skill",
          ...entry,
          sequence: entry.activation.sequence,
        });
      continue;
    }
    if (
      (effect.type !== "provoke" &&
        effect.type !== "mind-grip" &&
        effect.type !== "twin-bloom") ||
      (effect.type === "provoke" && effect.phase !== "waiting")
    )
      continue;
    if (effect.targetTurn < turn.number) {
      state = updateSkillActivation(
        state,
        entry.player,
        entry.activation.sequence,
        { status: "expired" },
      );
      events.push({
        type: "skill",
        player: entry.player,
        skillId: effect.type,
        public: entry.activation.public,
        status: "expired",
        state,
      });
    } else if (
      effect.targetTurn === turn.number &&
      ((effect.type === "provoke" &&
        opponentOf(entry.player) === turn.player) ||
        (effect.type === "twin-bloom" && entry.player === turn.player))
    ) {
      pending.push({
        kind: "skill",
        ...entry,
        sequence: entry.activation.sequence,
      });
    }
  }
  pending.sort(
    (a, b) =>
      a.sequence - b.sequence ||
      (a.player === b.player ? 0 : a.player === "human" ? -1 : 1),
  );
  for (const entry of pending) {
    if (entry.kind === "bandwagon") {
      const record = state.trumps!.table.find(
        (t) => t.effectId === entry.effectId,
      );
      if (!record) continue;
      if (
        isEffectActive(record, state.trumps!.table) &&
        record.copiedDefinitionId
      ) {
        closeUndoWindow();
        const grant = grantTrumps(
          state,
          turn.player,
          1,
          "trigger",
          random?.trumpSelection,
          record.copiedDefinitionId,
        );
        state = grant.state;
        events.push(...grant.events);
      }
      remove(record.effectId);
    } else {
      const effect = entry.activation.effect!;
      if (effect.type === "endless-life") {
        closeUndoWindow();
        const generated = tickEndlessLife(
          state,
          entry.player,
          entry.activation.sequence,
          random,
        );
        state = generated.state;
        events.push(...generated.events);
        continue;
      }
      if (effect.type === "twin-bloom") {
        closeUndoWindow();
        const copied = resolveTwinBloom(
          state,
          entry.player,
          entry.activation.sequence,
        );
        state = copied.state;
        events.push(...copied.events);
        continue;
      }
      if (effect.type !== "provoke") continue;
      closeUndoWindow();
      // @req REQ-2026-029: watch the empty-handed target without granting a trump.
      state = updateSkillActivation(
        state,
        entry.player,
        entry.activation.sequence,
        { effect: { ...effect, phase: "watching" } },
      );
      events.push({
        type: "skill",
        player: entry.player,
        skillId: "provoke",
        public: true,
        status: "prepared",
        state,
      });
    }
  }
  // Takeover arms only after every starting effect; its finite sequence is a separate atomic continuation.
  const control = pendingSkills(state).find(
    (entry) =>
      entry.activation.effect?.type === "mind-grip" &&
      entry.activation.effect.targetTurn === turn.number &&
      opponentOf(entry.player) === turn.player,
  );
  if (control) {
    closeUndoWindow();
    state = freezeData({
      ...state,
      turn: { ...state.turn!, controlledBy: control.player },
    });
    events.push({
      type: "skill",
      player: control.player,
      skillId: "mind-grip",
      public: true,
      status: "prepared",
      state,
    });
  }
  return freezeData({ state, events });
}
