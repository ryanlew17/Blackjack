// @req REQ-2026-019: execute only explicit rules/instances, never the candidate catalog.
import { freezeData } from "../immutable";
import type { NumberValue, PlayerId } from "../types";
import type {
  PlayTrumpCommand,
  TrumpObservation,
  TrumpRules,
  TrumpSetup,
  TrumpState,
} from "./effectTypes";
import type {
  RoundEvent,
  RoundObservation,
  RoundState,
  RoundTransition,
} from "./types";
import { opponentOf, recordTrumpConsumption } from "./turn";

export function createTrumpState(
  rules: TrumpRules,
  setup: TrumpSetup,
): TrumpState {
  const ids = new Set<string>();
  const copy = (player: PlayerId) =>
    setup[player].map((instance) => {
      if (
        !instance.instanceId ||
        ids.has(instance.instanceId) ||
        !Object.hasOwn(rules.definitions, instance.definitionId)
      )
        throw new RangeError("Invalid explicit trump setup");
      ids.add(instance.instanceId);
      return { ...instance };
    });
  return freezeData({
    hands: { human: copy("human"), ai: copy("ai") },
    table: [],
    discarded: [],
  });
}
export function observeTrumps(
  state: TrumpState,
  viewer: PlayerId,
): TrumpObservation {
  return {
    ownHand: state.hands[viewer],
    opponentHandCount: state.hands[opponentOf(viewer)].length,
    table: state.table,
    discarded: state.discarded,
  };
}
/** Uses public preconditions only. In particular, draw availability is NOT queried. */
export function legalTrumpCommands(
  view: RoundObservation,
): readonly PlayTrumpCommand[] {
  if (
    view.phase !== "acting" ||
    view.turn?.player !== view.viewer ||
    !view.trumps ||
    !view.rules.trumps
  )
    return [];
  const { trumps, rules, viewer } = view;
  return trumps.ownHand.flatMap((instance) => {
    const definition = rules.trumps!.definitions[instance.definitionId];
    if (!definition) return [];
    const replacesOwn =
      definition.table?.pointTarget != null
        ? trumps.table.filter(
            (t) => t.owner === viewer && t.pointTarget !== null,
          ).length
        : 0;
    if (
      definition.table &&
      trumps.table.filter((t) => t.owner === viewer).length - replacesOwn >=
        rules.trumps!.tableCapacity
    )
      return [];
    const returns = definition.onPlay.filter(
      (e) => e.type === "return-last",
    ).length;
    if (view.hands[viewer].cards.length - 1 < returns) return [];
    const removalCount = definition.onPlay.filter(
      (e) => e.type === "remove-table",
    ).length;
    if (removalCount > 1) return []; // One explicit target per minimal command.
    const removes = removalCount === 1;
    const targets = removes
      ? trumps.table.filter((t) => t.owner !== viewer).map((t) => t.instanceId)
      : [undefined];
    return targets.map((targetId) => ({
      type: "PlayTrump" as const,
      player: viewer,
      instanceId: instance.instanceId,
      ...(targetId ? { targetId } : {}),
    }));
  });
}

export function playTrump(
  original: RoundState,
  command: PlayTrumpCommand,
  view: RoundObservation,
): RoundTransition {
  if (
    !legalTrumpCommands(view).some(
      (c) =>
        c.instanceId === command.instanceId && c.targetId === command.targetId,
    )
  )
    return { state: original, events: [] };
  const instance = original.trumps!.hands[command.player].find(
    (c) => c.instanceId === command.instanceId,
  )!;
  const definition = original.rules.trumps!.definitions[instance.definitionId];
  let state: RoundState = original;
  const events: RoundEvent[] = [];
  const emit = (
    effect: "played" | "draw" | "return" | "placed" | "removed",
    extra: {
      card?: NumberValue | null;
      targetId?: string;
    } = {},
  ) => {
    state = freezeData(state);
    events.push({
      type: "trump",
      player: command.player,
      instance,
      effect,
      ...extra,
      state,
    });
  };
  // Escrow in discarded until placement: every frame conserves instance identity.
  state = {
    ...state,
    trumps: {
      ...state.trumps!,
      hands: {
        ...state.trumps!.hands,
        [command.player]: state.trumps!.hands[command.player].filter(
          (c) => c.instanceId !== instance.instanceId,
        ),
      },
      discarded: [...state.trumps!.discarded, instance],
    },
  };
  state = recordTrumpConsumption(state, command.player);
  emit("played");
  const remove = (targetId: string) => {
    const target = state.trumps!.table.find((t) => t.instanceId === targetId)!;
    const table = state.trumps!.table.filter((t) => t.instanceId !== targetId);
    state = {
      ...state,
      pointTarget:
        table.find((t) => t.pointTarget !== null)?.pointTarget ??
        state.rules.pointTarget,
      trumps: {
        ...state.trumps!,
        table,
        discarded: [
          ...state.trumps!.discarded,
          { instanceId: target.instanceId, definitionId: target.definitionId },
        ],
      },
    };
    emit("removed", { targetId });
  };
  for (const effect of definition.onPlay) {
    if (effect.type === "draw-number") {
      const index = state.deck.indexOf(effect.value);
      if (index >= 0)
        state = {
          ...state,
          hands: {
            ...state.hands,
            [command.player]: [...state.hands[command.player], effect.value],
          },
          deck: state.deck.filter((_, i) => i !== index),
        };
      emit("draw", { card: index >= 0 ? effect.value : null });
    } else if (effect.type === "return-last") {
      const hand = state.hands[command.player];
      const card = hand[hand.length - 1];
      state = {
        ...state,
        hands: { ...state.hands, [command.player]: hand.slice(0, -1) },
        deck: [...state.deck, card],
      };
      emit("return", { card });
    } else remove(command.targetId!);
  }
  if (definition.table) {
    if (definition.table.pointTarget !== null) {
      for (const target of state.trumps!.table.filter(
        (t) => t.pointTarget !== null,
      ))
        remove(target.instanceId);
    }
    state = {
      ...state,
      pointTarget: definition.table.pointTarget ?? state.pointTarget,
      trumps: {
        ...state.trumps!,
        discarded: state.trumps!.discarded.filter(
          (t) => t.instanceId !== instance.instanceId,
        ),
        table: [
          ...state.trumps!.table,
          {
            ...instance,
            owner: command.player,
            pointTarget: definition.table.pointTarget,
          },
        ],
      },
    };
    emit("placed");
  }
  return freezeData({ state, events });
}
