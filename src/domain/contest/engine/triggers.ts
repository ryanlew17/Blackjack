// @req REQ-2026-024: one finite pass per consumption/boundary; grants never enqueue plays.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import type { TableEffect } from "./effectTypes";
import type { EffectDelta } from "./numberCards";
import type { ResourceRandomSources } from "./resourceTypes";
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
  random?: ResourceRandomSources,
): RoundTransition {
  let state: RoundState = { ...original, turn };
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
  for (const prior of [...(state.trumps?.table ?? [])]) {
    const record = state.trumps!.table.find(
      (t) => t.effectId === prior.effectId,
    );
    if (
      record?.kind !== "bandwagon" ||
      record.watchedTurn! >= turn.number ||
      record.owner !== turn.player
    )
      continue;
    const active = isEffectActive(record, state.trumps!.table);
    if (active && record.copiedDefinitionId) {
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
  }
  return freezeData({ state, events });
}
