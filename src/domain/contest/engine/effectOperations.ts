// @req REQ-2026-024: remove suppression dependents before targets and record exact updates.
// @req REQ-2026-023: shared reversible mutations; no scoring or player-command dispatch here.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import type { EffectDelta, NumberLocation } from "./numberCards";
import type { TableEffect } from "./effectTypes";
import type { RoundState } from "./types";
import { tablePointTarget } from "./contributions";
export interface Mutation {
  readonly state: RoundState;
  readonly deltas: readonly EffectDelta[];
}
/** @req REQ-2026-024: attach the current transaction before publishing each mutation's frames. */
export type EffectRecorder = (
  state: RoundState,
  deltas: readonly EffectDelta[],
) => RoundState;

export function locateNumber(state: RoundState, id: string) {
  for (const player of ["human", "ai", null] as const) {
    const cards = player === null ? state.deck : state.hands[player];
    const index = cards.findIndex((c) => c.instanceId === id);
    if (index >= 0) return { card: cards[index], location: { player, index } };
  }
  throw new RangeError("Number instance is not live");
}
function region(state: RoundState, player: PlayerId | null) {
  return player === null ? state.deck : state.hands[player];
}
function replaceRegion(
  state: RoundState,
  player: PlayerId | null,
  cards: RoundState["deck"],
): RoundState {
  return player === null
    ? { ...state, deck: cards }
    : { ...state, hands: { ...state.hands, [player]: cards } };
}
export function removeEffect(state: RoundState, id: string): Mutation {
  const record = state.trumps!.table.find((t) => t.effectId === id);
  if (!record) return { state, deltas: [] };
  const deltas: EffectDelta[] = [];
  // Remove dependents first: undo restores their target before recreating the link.
  for (const dependent of state.trumps!.table.filter(
    (t) => t.targetEffectId === id,
  )) {
    const removed = removeEffect(state, dependent.effectId);
    state = removed.state;
    deltas.push(...removed.deltas);
  }
  const index = state.trumps!.table.findIndex((t) => t.effectId === id);
  let next: RoundState = {
    ...state,
    trumps: {
      ...state.trumps!,
      table: state.trumps!.table.filter((t) => t.effectId !== id),
    },
  };
  next = { ...next, pointTarget: tablePointTarget(next) };
  return {
    state: freezeData(next),
    deltas: [...deltas, { ...record, type: "effect-removed", index }],
  };
}
export function updateEffect(state: RoundState, record: TableEffect): Mutation {
  const before = state.trumps!.table.find(
    (t) => t.effectId === record.effectId,
  );
  if (!before) return { state, deltas: [] };
  let next = {
    ...state,
    trumps: {
      ...state.trumps!,
      table: state.trumps!.table.map((t) =>
        t.effectId === record.effectId ? record : t,
      ),
    },
  };
  next = { ...next, pointTarget: tablePointTarget(next) };
  return {
    state: freezeData(next),
    deltas: [{ type: "effect-updated", before, after: record }],
  };
}

export function detachBindings(state: RoundState, cardId: string): Mutation {
  const deltas: EffectDelta[] = [];
  for (const record of state.trumps?.table.filter((t) => t.cardId === cardId) ??
    []) {
    const removed = removeEffect(state, record.effectId);
    state = removed.state;
    deltas.push(...removed.deltas);
  }
  return { state, deltas };
}
export function moveNumber(
  state: RoundState,
  id: string,
  destination: NumberLocation,
): Mutation {
  const found = locateNumber(state, id);
  if (
    found.location.player !== null &&
    state.hiddenCards[found.location.player] === id
  )
    throw new RangeError("Cannot move the logical hidden slot");
  const bound =
    destination.player === null
      ? detachBindings(state, id)
      : { state, deltas: [] };
  let next = bound.state;
  next = replaceRegion(
    next,
    found.location.player,
    region(next, found.location.player).filter((c) => c.instanceId !== id),
  );
  const cards = [...region(next, destination.player)];
  cards.splice(destination.index, 0, found.card);
  next = replaceRegion(next, destination.player, cards);
  return {
    state: freezeData({
      ...next,
      lastPlay: null,
      deckRevision:
        next.deckRevision +
        (found.location.player === null || destination.player === null ? 1 : 0),
    }),
    deltas: [
      ...bound.deltas,
      {
        type: "number-move",
        instanceId: id,
        from: found.location,
        to: destination,
      },
    ],
  };
}
export function swapNumbers(state: RoundState, a: string, b: string): Mutation {
  const x = locateNumber(state, a),
    y = locateNumber(state, b);
  if (
    x.location.player === null ||
    y.location.player === null ||
    x.location.player === y.location.player ||
    state.hiddenCards[x.location.player] === a ||
    state.hiddenCards[y.location.player] === b
  )
    throw new RangeError("Invalid face-up swap");
  const first = [...state.hands[x.location.player]],
    second = [...state.hands[y.location.player]];
  first[x.location.index] = y.card;
  second[y.location.index] = x.card;
  return {
    state: freezeData({
      ...state,
      hands: {
        ...state.hands,
        [x.location.player]: first,
        [y.location.player]: second,
      },
      lastPlay: null,
    }),
    deltas: [
      {
        type: "numbers-swapped",
        a: { instanceId: a, player: x.location.player },
        b: { instanceId: b, player: y.location.player },
      },
    ],
  };
}
export function addEffect(
  state: RoundState,
  input: Omit<TableEffect, "effectId">,
  index = state.trumps!.table.length,
): Mutation {
  const record: TableEffect = {
    ...input,
    effectId:
      "game-" + state.trumps!.game + ":effect-" + state.trumps!.nextEffectId,
  };
  const table = [...state.trumps!.table];
  table.splice(index, 0, record);
  let next: RoundState = {
    ...state,
    trumps: {
      ...state.trumps!,
      nextEffectId: state.trumps!.nextEffectId + 1,
      table,
    },
  };
  next = { ...next, pointTarget: tablePointTarget(next) };
  return {
    state: freezeData(next),
    deltas: [{ ...record, type: "effect-added", index }],
  };
}
export function swapEffects(state: RoundState, a: string, b: string): Mutation {
  const first = state.trumps!.table.find((t) => t.effectId === a),
    second = state.trumps!.table.find((t) => t.effectId === b);
  if (!first || !second) throw new RangeError("Missing table exchange target");
  const table = state.trumps!.table.map((t) =>
    t.effectId === a
      ? { ...t, owner: second.owner }
      : t.effectId === b
        ? { ...t, owner: first.owner }
        : t,
  );
  return {
    state: freezeData({ ...state, trumps: { ...state.trumps!, table } }),
    deltas: [{ type: "effects-swapped", a, b }],
  };
}
export function setMultiplier(
  state: RoundState,
  player: PlayerId,
  value: 1 | 2,
): Mutation {
  const before = state.hiddenMultipliers[player];
  return before === value
    ? { state, deltas: [] }
    : {
        state: freezeData({
          ...state,
          hiddenMultipliers: { ...state.hiddenMultipliers, [player]: value },
        }),
        deltas: [{ type: "hidden-multiplier", player, before, after: value }],
      };
}
