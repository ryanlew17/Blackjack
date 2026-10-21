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
    effects = new Map<string, string>();
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
        (c) => c.instanceId === delta.instanceId,
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
    } else {
      const unsupported: never = delta;
      throw new Error("Unsupported inverse delta: " + String(unsupported));
    }
  }
  return { state, deltas };
}
