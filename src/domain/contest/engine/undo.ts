// @req REQ-2026-024: reverse trigger, marker and stock changes with capacity preflight.
// @req REQ-2026-023: reverse committed effect deltas, never payments/RNG/turns or knowledge.
import { freezeData } from "../immutable";
import type { RoundState } from "./types";
import type { CardTransaction, EffectDelta } from "./numberCards";
import { generateNumber, deleteNumber } from "./numberCards";
import { generateTrump, deleteTrump } from "./resources";
import {
  locateNumber,
  moveNumber,
  swapNumbers,
  addEffect,
  removeEffect,
  swapEffects,
  setMultiplier,
  updateEffect,
} from "./effectOperations";
import type { Mutation } from "./effectOperations";

export function undoLastPlay(
  original: RoundState,
  transaction: CardTransaction,
  sourceId: string,
): Mutation {
  if (transaction.type === "number")
    return moveNumber(original, transaction.instanceId, {
      player: null,
      index: original.deck.length,
    });
  let state = original;
  const deltas: EffectDelta[] = [];
  const numbers = new Map<string, string>(),
    effects = new Map<string, string>(),
    trumps = new Map<string, string>();
  const number = (id: string) => numbers.get(id) ?? id,
    effect = (id: string) => effects.get(id) ?? id;
  const apply = (m: Mutation) => {
    state = m.state;
    deltas.push(...m.deltas);
  };
  for (const delta of [...transaction.deltas].reverse()) {
    if (delta.type === "number-move") {
      apply(moveNumber(state, number(delta.instanceId), delta.from));
    } else if (delta.type === "numbers-swapped") {
      apply(
        swapNumbers(
          state,
          number(delta.a.instanceId),
          number(delta.b.instanceId),
        ),
      );
    } else if (delta.type === "number-generated") {
      const id = number(delta.instance.instanceId),
        live = locateNumber(state, id);
      const bound = state.trumps?.table.filter((t) => t.cardId === id) ?? [];
      for (const record of bound) apply(removeEffect(state, record.effectId));
      state = deleteNumber(state, live.location.player, id);
      deltas.push({
        type: "number-deleted",
        player: live.location.player,
        instance: live.card,
        index: live.location.index,
      });
    } else if (delta.type === "number-deleted") {
      state = generateNumber(
        state,
        delta.player,
        delta.instance.value,
        sourceId,
        delta.index,
      );
      const card = (
        delta.player === null ? state.deck : state.hands[delta.player]
      )[delta.index];
      numbers.set(delta.instance.instanceId, card.instanceId);
      deltas.push({
        type: "number-generated",
        player: delta.player,
        instance: card,
        index: delta.index,
      });
    } else if (
      delta.type === "trump-granted" ||
      delta.type === "trump-generated"
    ) {
      const index = state.trumps!.hands[delta.player].findIndex(
        (c) =>
          c.instanceId === (trumps.get(delta.instanceId) ?? delta.instanceId),
      );
      if (index < 0) continue; // Already paid as this command's irreversible cost.
      const instance = state.trumps!.hands[delta.player][index];
      state = freezeData({
        ...state,
        trumps: deleteTrump(state.trumps!, delta.player, instance.instanceId),
      });
      deltas.push({
        type: "trump-deleted",
        player: delta.player,
        instance,
        index,
      });
    } else if (delta.type === "trump-deleted") {
      const generated = generateTrump(
        state.trumps!,
        delta.player,
        delta.instance.definitionId,
        sourceId,
        state.rules.trumps!,
      );
      if (!generated.instance)
        throw new RangeError("Undo window has incompatible hand capacity");
      trumps.set(delta.instance.instanceId, generated.instance.instanceId);
      const cards = generated.state.hands[delta.player].filter(
        (c) => c.instanceId !== generated.instance!.instanceId,
      );
      const hand = [...cards];
      hand.splice(delta.index, 0, generated.instance);
      state = freezeData({
        ...state,
        trumps: {
          ...generated.state,
          hands: { ...generated.state.hands, [delta.player]: hand },
        },
      });
      deltas.push({
        type: "trump-generated",
        player: delta.player,
        instanceId: generated.instance.instanceId,
      });
    } else if (delta.type === "effect-added") {
      apply(removeEffect(state, effect(delta.effectId)));
    } else if (delta.type === "effect-removed") {
      const { type: _type, index, effectId: oldId, ...record } = delta;
      const added = addEffect(
        state,
        {
          ...record,
          ...(record.cardId ? { cardId: number(record.cardId) } : {}),
          ...(record.targetEffectId
            ? { targetEffectId: effect(record.targetEffectId) }
            : {}),
        },
        index,
      );
      const restored = added.deltas[0];
      if (restored.type !== "effect-added")
        throw new Error("Invalid effect restoration");
      effects.set(oldId, restored.effectId);
      apply(added);
    } else if (delta.type === "effects-swapped") {
      apply(swapEffects(state, effect(delta.a), effect(delta.b)));
    } else if (delta.type === "hidden-multiplier") {
      apply(setMultiplier(state, delta.player, delta.before));
    } else if (delta.type === "effect-updated") {
      apply(
        updateEffect(state, {
          ...delta.before,
          effectId: effect(delta.before.effectId),
          ...(delta.before.targetEffectId
            ? { targetEffectId: effect(delta.before.targetEffectId) }
            : {}),
        }),
      );
    } else if (delta.type === "sudden-death") {
      deltas.push({
        type: "sudden-death",
        before: state.suddenDeath,
        after: delta.before,
      });
      const { suddenDeath: _marker, ...rest } = state;
      state = {
        ...rest,
        ...(delta.before ? { suddenDeath: delta.before } : {}),
      };
    } else if (delta.type === "trump-stock-deleted") {
      // Recreate content as a generated stock instance; never restore the deleted original/quota.
      const generated = generateTrump(
        state.trumps!,
        delta.player,
        delta.instance.definitionId,
        sourceId,
        state.rules.trumps!,
        "stock",
      );
      const cards = generated.state.stock[delta.player].filter(
        (c) => c.instanceId !== generated.instance!.instanceId,
      );
      cards.splice(delta.index, 0, generated.instance!);
      state = {
        ...state,
        trumps: {
          ...generated.state,
          stock: { ...generated.state.stock, [delta.player]: cards },
        },
      };
      trumps.set(delta.instance.instanceId, generated.instance!.instanceId);
      deltas.push({
        type: "trump-stock-generated",
        player: delta.player,
        instanceId: generated.instance!.instanceId,
      });
    } else if (delta.type === "trump-stock-generated") {
      const id = trumps.get(delta.instanceId) ?? delta.instanceId;
      const index = state.trumps!.stock[delta.player].findIndex(
        (c) => c.instanceId === id,
      );
      if (index >= 0) {
        const instance = state.trumps!.stock[delta.player][index];
        state = {
          ...state,
          trumps: deleteTrump(state.trumps!, delta.player, id, "deleted", true),
        };
        deltas.push({
          type: "trump-stock-deleted",
          player: delta.player,
          instance,
          index,
        });
      }
    } else {
      const unsupported: never = delta;
      throw new Error("Unsupported inverse delta: " + String(unsupported));
    }
  }
  return { state: freezeData(state), deltas };
}

/** @req REQ-2026-024: capacity-only preflight. No definitions/values of hidden cards are inspected. */
export function canUndoWith(
  original: RoundState,
  player: import("../types").PlayerId,
  payment: string,
): boolean {
  const transaction = original.lastPlay;
  if (!transaction || transaction.type === "number") return true;
  const hands = {
    human: new Set<unknown>(
      original.trumps!.hands.human.map((c) => c.instanceId),
    ),
    ai: new Set<unknown>(original.trumps!.hands.ai.map((c) => c.instanceId)),
  };
  hands[player].delete(payment);
  const restored = new Map<string, object>();
  for (const delta of [...transaction.deltas].reverse()) {
    if (delta.type === "trump-granted" || delta.type === "trump-generated")
      hands[delta.player].delete(
        restored.get(delta.instanceId) ?? delta.instanceId,
      );
    if (delta.type === "trump-deleted") {
      const token = {};
      restored.set(delta.instance.instanceId, token);
      hands[delta.player].add(token);
      if (hands[delta.player].size > 8) return false;
    }
  }
  return true;
}
