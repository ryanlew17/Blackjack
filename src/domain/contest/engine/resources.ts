// @req REQ-2026-022: finite no-replacement stock; generated cards have a separate origin.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import type {
  TrumpInstance,
  TrumpRules,
  TrumpSetup,
  TrumpState,
  TrumpObservation,
  TrumpDestruction,
  ResourceCause,
} from "./effectTypes";
import type { RandomSource } from "./numbers";
import { randomUnit } from "./numbers";
import type { RoundEvent, RoundState, RoundTransition } from "./types";
import { opponentOf } from "./turn";

export function createTrumpState(
  rules: TrumpRules,
  setup?: TrumpSetup,
  game = 1,
): TrumpState {
  if (setup && rules.resources)
    throw new RangeError("Use either explicit fixture hands or resource stock");
  const ids = new Set<string>();
  const copy = (player: PlayerId): TrumpInstance[] =>
    (setup?.[player] ?? []).map((seed) => {
      if (
        !seed.instanceId ||
        ids.has(seed.instanceId) ||
        !Object.hasOwn(rules.definitions, seed.definitionId)
      )
        throw new RangeError("Invalid explicit trump setup");
      const instanceId =
        game === 1 ? seed.instanceId : "game-" + game + ":" + seed.instanceId;
      ids.add(seed.instanceId);
      return {
        instanceId,
        definitionId: seed.definitionId,
        origin: { type: "fixture", owner: player, game },
      };
    });
  const stock = (player: PlayerId): TrumpInstance[] =>
    Object.entries(rules.resources?.stock ?? {}).flatMap(
      ([definitionId, count]) =>
        Array.from({ length: count }, (_, i) => ({
          instanceId:
            "game-" + game + ":" + player + ":stock-" + definitionId + "-" + i,
          definitionId,
          origin: { type: "stock" as const, owner: player, game },
        })),
    );
  const hands = { human: copy("human"), ai: copy("ai") };
  if (hands.human.length > 8 || hands.ai.length > 8)
    throw new RangeError("Trump fixture hand exceeds capacity");
  return freezeData({
    game,
    hands,
    stock: { human: stock("human"), ai: stock("ai") },
    table: [],
    destroyed: [],
    nextGeneratedId: 1,
    nextEffectId: 1,
  });
}

export function observeTrumps(
  state: TrumpState,
  viewer: PlayerId,
): TrumpObservation {
  return freezeData({
    ownHand: state.hands[viewer],
    opponentHandCount: state.hands[opponentOf(viewer)].length,
    stockCounts: { human: state.stock.human.length, ai: state.stock.ai.length },
    table: state.table,
    destroyed: state.destroyed.map((d) => ({
      owner: d.owner,
      reason: d.reason,
      instance: d.public || d.owner === viewer ? d.instance : null,
    })),
  });
}

export function drawTrump(
  state: TrumpState,
  player: PlayerId,
  random?: RandomSource,
  definitionId?: string,
): { readonly state: TrumpState; readonly instance: TrumpInstance | null } {
  if (state.hands[player].length >= 8 || state.stock[player].length === 0)
    return { state, instance: null };
  const index =
    definitionId === undefined
      ? Math.floor(randomUnit(random!) * state.stock[player].length)
      : state.stock[player].findIndex((c) => c.definitionId === definitionId);
  if (index < 0) return { state, instance: null };
  const instance = state.stock[player][index];
  return freezeData({
    state: {
      ...state,
      stock: {
        ...state.stock,
        [player]: state.stock[player].filter((_, i) => i !== index),
      },
      hands: { ...state.hands, [player]: [...state.hands[player], instance] },
    },
    instance,
  });
}
export function generateTrump(
  state: TrumpState,
  player: PlayerId,
  definitionId: string,
  sourceId: string,
  rules: TrumpRules,
): { readonly state: TrumpState; readonly instance: TrumpInstance | null } {
  if (!sourceId || !Object.hasOwn(rules.definitions, definitionId))
    throw new RangeError("Invalid trump generation");
  if (state.hands[player].length >= 8) return { state, instance: null };
  const used = new Set(
    [
      ...state.hands.human,
      ...state.hands.ai,
      ...state.stock.human,
      ...state.stock.ai,
      ...state.destroyed.map((d) => d.instance),
    ].map((c) => c.instanceId),
  );
  let serial = state.nextGeneratedId;
  while (used.has("game-" + state.game + ":generated-" + serial)) serial++;
  const instance: TrumpInstance = {
    instanceId: "game-" + state.game + ":generated-" + serial,
    definitionId,
    origin: { type: "generated", sourceId },
  };
  return freezeData({
    state: {
      ...state,
      nextGeneratedId: serial + 1,
      hands: { ...state.hands, [player]: [...state.hands[player], instance] },
    },
    instance,
  });
}
export function deleteTrump(
  state: TrumpState,
  player: PlayerId,
  instanceId: string,
  reason: TrumpDestruction["reason"] = "deleted",
  isPublic = false,
): TrumpState {
  const held = state.hands[player].find((c) => c.instanceId === instanceId);
  const instance =
    held ?? state.stock[player].find((c) => c.instanceId === instanceId);
  if (!instance) return state;
  return freezeData({
    ...state,
    hands: held
      ? {
          ...state.hands,
          [player]: state.hands[player].filter(
            (c) => c.instanceId !== instanceId,
          ),
        }
      : state.hands,
    stock: held
      ? state.stock
      : {
          ...state.stock,
          [player]: state.stock[player].filter(
            (c) => c.instanceId !== instanceId,
          ),
        },
    destroyed: [
      ...state.destroyed,
      { instance, owner: player, reason, public: isPublic },
    ],
  });
}
/** Targeted stock deletion for REQ-024: a miss never probes randomness or the other region. */
export function deleteStockTrump(
  state: TrumpState,
  player: PlayerId,
  definitionId: string,
  isPublic = false,
): { readonly state: TrumpState; readonly instance: TrumpInstance | null } {
  const instance =
    state.stock[player].find((c) => c.definitionId === definitionId) ?? null;
  return {
    state: instance
      ? deleteTrump(state, player, instance.instanceId, "deleted", isPublic)
      : state,
    instance,
  };
}

export function transferTrump(
  state: TrumpState,
  from: PlayerId,
  to: PlayerId,
  instanceId: string,
): TrumpState {
  if (from === to || state.hands[to].length >= 8) return state;
  const instance = state.hands[from].find((c) => c.instanceId === instanceId);
  if (!instance) return state;
  return freezeData({
    ...state,
    hands: {
      ...state.hands,
      [from]: state.hands[from].filter((c) => c.instanceId !== instanceId),
      [to]: [...state.hands[to], instance],
    },
  });
}

/** One event per attempt, including a legal zero grant; never recursively plays a card. */
export function grantTrumps(
  original: RoundState,
  player: PlayerId,
  count: number,
  cause: ResourceCause,
  selection?: RandomSource,
  definitionId?: string,
): RoundTransition {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new RangeError("Invalid grant count");
  if (!original.trumps) return { state: original, events: [] };
  let state = original;
  const events: RoundEvent[] = [];
  for (let i = 0; i < count; i++) {
    const draw = drawTrump(state.trumps!, player, selection, definitionId);
    state = freezeData({ ...state, trumps: draw.state });
    events.push({
      type: "resource",
      operation: "draw",
      player,
      cause,
      instance: draw.instance,
      public: false,
      state,
    });
    if (!draw.instance) break;
  }
  return freezeData({ state, events });
}
