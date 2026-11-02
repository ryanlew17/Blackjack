// @req REQ-2026-027: one ordinary Hit step, optionally handing over; controlled Turns reuse its exact gate/effects.
import { freezeData } from "../immutable";
import { effectiveTotals } from "./contributions";
import { resourceRandom, type ResourceRandomSources } from "./resourceTypes";
import { randomUnit } from "./numbers";
import { affectsTurn, isEffectActive } from "./tableEffects";
import { moveNumber, removeEffect } from "./effectOperations";
import { grantTrumps } from "./resources";
import type {
  RoundState,
  RoundEvent,
  RoundTransition,
  TurnState,
} from "./types";
export function ordinaryHit(
  original: RoundState,
  random?: ResourceRandomSources,
  followingTurn?: TurnState,
): RoundTransition {
  const turn = original.turn!;
  const policy = original.rules.trumps?.resources;
  const sources = policy ? resourceRandom(random) : undefined;
  const table = original.trumps?.table ?? [];
  const heavy = table.some(
    (t) =>
      t.kind === "heavy-hit" &&
      affectsTurn(t, turn) &&
      isEffectActive(t, table),
  );
  const count = heavy ? 2 : original.hitDrawCounts[turn.player];
  const safeguards = table.filter(
    (t) =>
      t.kind === "safe-hit" &&
      t.owner === turn.player &&
      isEffectActive(t, table),
  );
  let state = original;
  const events: RoundEvent[] = [];
  const remove = (id: string) => {
    const removed = removeEffect(state, id);
    state = removed.state;
    for (const d of removed.deltas)
      if (d.type === "effect-removed")
        events.push({
          type: "table-effect",
          operation: "removed",
          effectId: d.effectId,
          state,
        });
  };
  for (let index = 0; index < count && state.deck.length; index++) {
    const card = state.deck[0];
    state = freezeData({
      ...state,
      hands: {
        ...state.hands,
        [turn.player]: [...state.hands[turn.player], card],
      },
      deck: state.deck.slice(1),
      deckRevision: state.deckRevision + 1,
      lastPlay: {
        type: "number",
        player: turn.player,
        instanceId: card.instanceId,
      },
      quietStays: 0,
    });
    events.push({
      type: "hit",
      player: turn.player,
      card: card.value,
      state,
    });
    if (index === 0 && safeguards.length) {
      if (effectiveTotals(state)[turn.player] > state.pointTarget) {
        state = moveNumber(state, card.instanceId, {
          player: null,
          index: state.deck.length,
        }).state;
        const source = state.trumps!.destroyed.find(
          (d) => d.instance.instanceId === safeguards[0].sourceInstanceId,
        )!.instance;
        events.push({
          type: "trump",
          player: turn.player,
          instance: source,
          effect: "return",
          card: card.value,
          state,
        });
      }
      for (const record of safeguards) remove(record.effectId);
    }
  }
  if (followingTurn) {
    state = freezeData({ ...state, turn: followingTurn });
    // Preserve the established normal-Hit handover frame, including Safe Hit returns.
    let lastHit = events.length - 1;
    while (events[lastHit].type !== "hit") lastHit--;
    for (let i = lastHit; i < events.length; i++)
      events[i] = {
        ...events[i],
        state: freezeData({ ...events[i].state, turn: followingTurn }),
      };
  }
  if (policy && randomUnit(sources!.trumpGate) < policy.hitProbability) {
    const caches = state.trumps!.table.filter(
      (t) =>
        t.kind === "supply-cache" &&
        t.owner === turn.player &&
        isEffectActive(t, state.trumps!.table),
    );
    const grant = grantTrumps(
      state,
      turn.player,
      caches.length ? 2 : 1,
      "hit",
      sources!.trumpSelection,
      undefined,
      turn,
    );
    state = grant.state;
    events.push(...grant.events);
    for (const record of caches) remove(record.effectId);
  }
  return freezeData({ state, events });
}
