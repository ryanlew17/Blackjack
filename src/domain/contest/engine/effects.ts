// @req REQ-2026-027: share private committed ordering with skill Turn-start effects.
// @req REQ-2026-024: one atomic card executor includes actual trigger and stock deltas.
// @req REQ-2026-019/022/023: one atomic executor for numeric cards and effect records.
import { recoverSkillUse } from "./skillRecovery";
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import type { PlayTrumpCommand, TrumpEventPayload } from "./effectTypes";
import type {
  RoundEvent,
  RoundObservation,
  RoundState,
  RoundTransition,
} from "./types";
import type { ResourceRandomSources } from "./resourceTypes";
import type { EffectDelta } from "./numberCards";
import { generateNumber, deleteNumber } from "./numberCards";
import {
  deleteTrump,
  deleteStockTrump,
  generateTrump,
  grantTrumps,
} from "./resources";
import { opponentOf, recordTrumpConsumption, nextTurnNumberFor } from "./turn";
import { legalTrumpCommands, redirectedEffectChoice } from "./trumpLegality";
import { observeRound } from "./observation";
import { interceptTrump } from "./soulTransfer";
import { effectiveTotals, sameGlobalGroup } from "./contributions";
import {
  moveNumber,
  swapNumbers,
  removeEffect,
  detachBindings,
  addEffect,
  swapEffects,
  setMultiplier,
} from "./effectOperations";
import type { EffectRecorder, Mutation } from "./effectOperations";
import { undoLastPlay, canUndoWith } from "./undo";
import { respondToPlay } from "./triggers";
import { shortLived } from "./tableEffects";
export { legalTrumpCommands } from "./trumpLegality";
export { createTrumpState, observeTrumps } from "./resources";

function equalCosts(
  a: readonly string[] = [],
  b: readonly string[] = [],
): boolean {
  return (
    a.length === b.length &&
    new Set(b).size === b.length &&
    a.every((id) => b.includes(id))
  );
}
export function playTrump(
  original: RoundState,
  command: PlayTrumpCommand,
  view: RoundObservation,
  random?: ResourceRandomSources,
): RoundTransition {
  if (
    !legalTrumpCommands(view).some(
      (c) =>
        c.instanceId === command.instanceId &&
        c.targetId === command.targetId &&
        c.ownTargetId === command.ownTargetId &&
        c.definitionId === command.definitionId &&
        equalCosts(c.costIds, command.costIds),
    )
  )
    return { state: original, events: [] };
  const instance = original.trumps!.hands[command.player].find(
    (c) => c.instanceId === command.instanceId,
  )!;
  const definition = original.rules.trumps!.definitions[instance.definitionId];
  const activationSequence = original.skills?.nextActivationSequence;
  const previous = original.lastPlay;
  const existing = original.trumps!.table;
  let state = original;
  let effectPlayer = command.player;
  const events: RoundEvent[] = [],
    deltas: EffectDelta[] = [];
  const side = (target: "self" | "opponent" | undefined): PlayerId =>
    target === "opponent" ? opponentOf(effectPlayer) : effectPlayer;
  const transaction = (next: RoundState) =>
    freezeData({
      ...next,
      lastPlay: {
        type: "trump" as const,
        player: command.player,
        ...(effectPlayer !== command.player ? { effectPlayer } : {}),
        instanceId: instance.instanceId,
        deltas: [...deltas],
      },
    });
  const record: EffectRecorder = (next, changes) => {
    deltas.push(...changes);
    return transaction(next);
  };
  const emit = (
    effect: TrumpEventPayload["effect"],
    extra: Pick<TrumpEventPayload, "card" | "targetId" | "privateCards"> = {},
  ) => {
    state = transaction(state);
    events.push({
      type: "trump",
      player: command.player,
      instance,
      effect,
      ...(effectPlayer !== command.player ? { effectPlayer } : {}),
      ...extra,
      state,
    });
  };
  const apply = (mutation: Mutation) => {
    state = mutation.state;
    deltas.push(...mutation.deltas);
  };
  const removedFrames = (changes: readonly EffectDelta[]) => {
    for (const delta of changes)
      if (delta.type === "effect-removed")
        emit("removed", { targetId: delta.effectId });
  };
  let trumps = deleteTrump(
    state.trumps!,
    command.player,
    instance.instanceId,
    "played",
    true,
  );
  const costs = (command.costIds ?? []).map((id) =>
    trumps.hands[command.player].find((c) => c.instanceId === id)!,
  );
  for (const cost of costs)
    trumps = deleteTrump(trumps, command.player, cost.instanceId, "cost");
  state = recordTrumpConsumption({ ...state, trumps }, command.player);
  if (state.skills)
    state = freezeData({
      ...state,
      skills: {
        ...state.skills,
        nextActivationSequence: state.skills.nextActivationSequence + 1,
      },
    });
  emit("played");
  for (const cost of costs)
    events.push({
      type: "resource",
      operation: "delete",
      player: command.player,
      cause: "cost",
      instance: cost,
      public: false,
      state,
    });
  const intercepted = interceptTrump(state, command.player);
  effectPlayer = intercepted.effectPlayer;
  state = transaction(intercepted.state);
  events.push(
    ...intercepted.events.map((e) => ({ ...e, state: transaction(e.state) })),
  );
  // Planning sees paid costs and the skill reward, while Undo still refers to the previous actual play.
  const planning = { ...state, lastPlay: previous };
  const resolved =
    effectPlayer === command.player
      ? command
      : redirectedEffectChoice(
          observeRound(planning, effectPlayer),
          definition,
          command,
          canUndoWith(planning, effectPlayer, instance.instanceId),
        );
  const remove = (id: string) => {
    const result = removeEffect(state, id);
    apply(result);
    removedFrames(result.deltas);
  };
  const draw = (player: PlayerId, index: number) => {
    const card = index < 0 ? null : state.deck[index];
    if (card)
      apply(
        moveNumber(state, card.instanceId, {
          player,
          index: state.hands[player].length,
        }),
      );
    emit("draw", { card: card?.value ?? null });
  };
  const returnCard = (id: string) => {
    const result = moveNumber(state, id, {
      player: null,
      index: state.deck.length,
    });
    apply(result);
    const delta = result.deltas.find((d) => d.type === "number-move")!;
    const card = state.deck.find((c) => c.instanceId === id)!;
    emit("return", { card: card.value });
    removedFrames(result.deltas);
    return delta;
  };
  if (resolved) {
    for (const effect of definition.onPlay) {
      if (effect.type === "draw-number")
        draw(
          effectPlayer,
          state.deck.findIndex((c) => c.value === effect.value),
        );
      else if (effect.type === "draw-best") {
        const space = state.pointTarget - effectiveTotals(state)[effectPlayer];
        let safe = -1,
          lowest = -1;
        for (let i = 0; i < state.deck.length; i++) {
          const value = state.deck[i].value;
          if (lowest < 0 || value < state.deck[lowest].value) lowest = i;
          if (value <= space && (safe < 0 || value > state.deck[safe].value))
            safe = i;
        }
        draw(effectPlayer, safe >= 0 ? safe : lowest);
      } else if (effect.type === "draw-top") {
        const player = side(effect.target);
        for (let i = 0; i < effect.count && state.deck.length; i++)
          draw(player, 0);
      } else if (effect.type === "return-last") {
        returnCard(state.hands[side(effect.target)].at(-1)!.instanceId);
      } else if (effect.type === "swap-last") {
        apply(
          swapNumbers(
            state,
            state.hands[effectPlayer].at(-1)!.instanceId,
            state.hands[opponentOf(effectPlayer)].at(-1)!.instanceId,
          ),
        );
        emit("swapped");
      } else if (effect.type === "remove-table") remove(resolved.targetId!);
      else if (
        effect.type === "remove-latest" ||
        effect.type === "remove-all"
      ) {
        const targets = state.trumps!.table.filter(
          (t) => t.owner === side(effect.target),
        );
        for (const record of effect.type === "remove-latest"
          ? targets.slice(-1)
          : targets)
          remove(record.effectId);
      } else if (effect.type === "grant-trumps") {
        const player = side(effect.target);
        const granted = grantTrumps(
          state,
          player,
          effect.count,
          "effect",
          random?.trumpSelection,
          effect.definitionId,
          undefined,
          record,
        );
        state = granted.state;
        events.push(...granted.events);
      } else if (effect.type === "generate-trump") {
        const generated = generateTrump(
          state.trumps!,
          effectPlayer,
          effect.definitionId,
          instance.instanceId,
          state.rules.trumps!,
        );
        if (generated.instance)
          deltas.push({
            type: "trump-generated",
            player: effectPlayer,
            instanceId: generated.instance.instanceId,
          });
        state = transaction({ ...state, trumps: generated.state });
        events.push({
          type: "resource",
          operation: "generate",
          player: effectPlayer,
          cause: "effect",
          instance: generated.instance,
          public: false,
          state,
        });
      } else if (effect.type === "generate-number") {
        state = generateNumber(
          state,
          effectPlayer,
          effect.value,
          instance.instanceId,
        );
        const card = state.hands[effectPlayer].at(-1)!;
        deltas.push({
          type: "number-generated",
          player: effectPlayer,
          instance: card,
          index: state.hands[effectPlayer].length - 1,
        });
        emit("generated-number", { card: card.value });
      } else if (effect.type === "delete-last-number") {
        const player = side(effect.target),
          index = state.hands[player].length - 1,
          card = state.hands[player][index];
        const bindings = detachBindings(state, card.instanceId);
        apply(bindings);
        state = deleteNumber(state, player, card.instanceId);
        deltas.push({ type: "number-deleted", player, instance: card, index });
        emit("deleted-number", { card: card.value });
        removedFrames(bindings.deltas);
      } else if (effect.type === "hidden-multiplier") {
        apply(setMultiplier(state, side(effect.target), effect.value));
        emit("modified");
      } else if (effect.type === "reveal-hidden") {
        const player = side(effect.target),
          id = state.hiddenCards[player]!;
        state = {
          ...state,
          revealed: state.revealed.includes(player)
            ? state.revealed
            : [...state.revealed, player],
        };
        emit("revealed", {
          targetId: id,
          card: state.hands[player].find((c) => c.instanceId === id)!.value,
        });
      } else if (effect.type === "scry") {
        const cards = state.deck.slice(0, effect.count);
        state = {
          ...state,
          scry: {
            ...state.scry,
            [effectPlayer]: { revision: state.deckRevision, cards },
          },
        };
        emit("peek", { privateCards: cards.map((c) => c.value) });
      } else if (effect.type === "rotate-deck") {
        apply(
          moveNumber(state, state.deck[0].instanceId, {
            player: null,
            index: state.deck.length - 1,
          }),
        );
        emit("rotated");
      } else if (effect.type === "trim") {
        for (const card of state.hands[effectPlayer].filter(
          (c) =>
            c.instanceId !== state.hiddenCards[effectPlayer] && c.value >= 8,
        ))
          returnCard(card.instanceId);
      } else if (effect.type === "exchange-table") {
        apply(swapEffects(state, resolved.ownTargetId!, resolved.targetId!));
        emit("exchanged", { targetId: resolved.targetId });
      } else if (effect.type === "undo-last") {
        apply(undoLastPlay(state, previous!, instance.instanceId));
        emit("undone");
      } else if (effect.type === "delete-stock") {
        const player = side(effect.target);
        const index = state.trumps!.stock[player].findIndex(
          (c) => c.definitionId === resolved.definitionId,
        );
        const deleted = deleteStockTrump(
          state.trumps!,
          player,
          resolved.definitionId!,
          true,
        );
        state = { ...state, trumps: deleted.state };
        if (deleted.instance)
          deltas.push({
            type: "trump-stock-deleted",
            player,
            instance: deleted.instance,
            index,
          });
        state = transaction(state);
        events.push({
          type: "resource",
          player,
          operation: "delete",
          cause: "effect",
          definitionId: resolved.definitionId,
          instance: deleted.instance,
          public: true,
          state,
        });
      } else if (effect.type === "recover-skill-use") {
        apply(recoverSkillUse(state, effectPlayer));
        emit("skill-recovered");
      } else if (effect.type === "sudden-death") {
        const marker = {
          player: effectPlayer,
          sourceInstanceId: instance.instanceId,
        };
        deltas.push({
          type: "sudden-death",
          before: state.suddenDeath,
          after: marker,
        });
        state = { ...state, suddenDeath: marker };
        emit("sudden-death");
      }
    }
    if (definition.table) {
      for (const record of state.trumps!.table.filter((t) =>
        sameGlobalGroup(definition.table!, t),
      ))
        remove(record.effectId);
      const spec = definition.table;
      const pointTarget =
        spec.kind === "resonance"
          ? 21 + state.hands.human.length + state.hands.ai.length - 2
          : spec.pointTarget;
      apply(
        addEffect(state, {
          ...spec,
          pointTarget,
          sourceInstanceId: instance.instanceId,
          definitionId: instance.definitionId,
          owner: effectPlayer,
          ...(shortLived(spec.kind)
            ? {
                affectedPlayer: opponentOf(effectPlayer),
                expiresAfterTurn: nextTurnNumberFor(
                  state.turn!,
                  opponentOf(effectPlayer),
                ),
              }
            : {}),
          ...(spec.kind === "suppress"
            ? { targetEffectId: resolved.targetId }
            : {}),
          ...(spec.kind === "bandwagon"
            ? {
                watchedTurn: nextTurnNumberFor(
                  state.turn!,
                  opponentOf(effectPlayer),
                ),
                ...(activationSequence !== undefined
                  ? { activationSequence }
                  : {}),
              }
            : {}),
          ...(spec.kind === "face-lighten" || spec.kind === "face-burden"
            ? {
                cardId: resolved.targetId!,
                adjustment:
                  spec.kind === "face-lighten" ? (-2 as const) : (2 as const),
              }
            : {}),
        }),
      );
      emit("placed");
    }
  } else emit("ineffective");
  const triggered = respondToPlay(
    state,
    command.player,
    instance.definitionId,
    existing,
    random,
    record,
  );
  events.push(...triggered.events);
  state = transaction(triggered.state);
  events[events.length - 1] = { ...events[events.length - 1], state };
  return freezeData({ state, events });
}
