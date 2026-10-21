// @req REQ-2026-024: extend inverse deltas and remove dependent suppression on number deletion.
// @req REQ-2026-023: numeric contributions, authorized information and reversible effects.
// @req REQ-2026-022: one live region per identity, even with duplicate values.
import { freezeData } from "../immutable";
import type { NumberValue, PlayerId } from "../types";
import type { RoundState } from "./types";
import { NUMBER_VALUES } from "./numbers";

export interface NumberInstance {
  readonly instanceId: string;
  readonly value: NumberValue;
  readonly origin:
    | { readonly type: "initial" }
    | { readonly type: "generated"; readonly sourceId: string };
}
export interface NumberLocation {
  readonly player: PlayerId | null;
  readonly index: number;
}
type DeltaKinds<K extends string, T> = {
  [P in K]: { readonly type: P } & T;
}[K];
export type EffectDelta =
  | {
      readonly type: "number-move";
      readonly instanceId: string;
      readonly from: NumberLocation;
      readonly to: NumberLocation;
    }
  | DeltaKinds<
      "number-generated" | "number-deleted",
      {
        readonly player: PlayerId | null;
        readonly instance: NumberInstance;
        readonly index: number;
      }
    >
  | DeltaKinds<
      "trump-granted" | "trump-generated",
      { readonly player: PlayerId; readonly instanceId: string }
    >
  | DeltaKinds<
      "effect-added" | "effect-removed",
      import("./effectTypes").TableEffect & { readonly index: number }
    >
  | {
      readonly type: "trump-deleted";
      readonly player: PlayerId;
      readonly instance: import("./effectTypes").TrumpInstance;
      readonly index: number;
    }
  | {
      readonly type: "numbers-swapped";
      readonly a: { readonly instanceId: string; readonly player: PlayerId };
      readonly b: { readonly instanceId: string; readonly player: PlayerId };
    }
  | { readonly type: "effects-swapped"; readonly a: string; readonly b: string }
  | {
      readonly type: "hidden-multiplier";
      readonly player: PlayerId;
      readonly before: 1 | 2;
      readonly after: 1 | 2;
    }
  | {
      readonly type: "effect-updated";
      readonly before: import("./effectTypes").TableEffect;
      readonly after: import("./effectTypes").TableEffect;
    }
  | DeltaKinds<
      "trump-stock-deleted",
      {
        readonly player: PlayerId;
        readonly instance: import("./effectTypes").TrumpInstance;
        readonly index: number;
      }
    >
  | DeltaKinds<
      "trump-stock-generated",
      { readonly player: PlayerId; readonly instanceId: string }
    >
  | {
      readonly type: "sudden-death";
      readonly before: import("./effectTypes").SuddenDeathMarker | undefined;
      readonly after: import("./effectTypes").SuddenDeathMarker | undefined;
    };

export type CardTransaction =
  | {
      readonly type: "number";
      readonly player: PlayerId;
      readonly instanceId: string;
    }
  | {
      readonly type: "trump";
      readonly player: PlayerId;
      readonly instanceId: string;
      readonly deltas: readonly EffectDelta[];
    };

/** Draw order is private; IDs do not encode a card value. */
export function initialNumberInstances(
  values: readonly NumberValue[],
  scope: number,
): readonly NumberInstance[] {
  return values.map((value, index) => ({
    instanceId: "round-" + scope + ":initial-" + index,
    value,
    origin: { type: "initial" },
  }));
}
export function generateNumber(
  state: RoundState,
  player: PlayerId | null,
  value: NumberValue,
  sourceId: string,
  index = player === null ? state.deck.length : state.hands[player].length,
): RoundState {
  if (!NUMBER_VALUES.includes(value) || !sourceId)
    throw new RangeError("Invalid number generation");
  const card: NumberInstance = {
    instanceId:
      "round-" + state.numberScope + ":generated-" + state.nextNumberId,
    value,
    origin: { type: "generated", sourceId },
  };
  const cards = [...(player === null ? state.deck : state.hands[player])];
  cards.splice(index, 0, card);
  return freezeData({
    ...state,
    nextNumberId: state.nextNumberId + 1,
    lastPlay: null,
    ...(player === null
      ? { deck: cards, deckRevision: state.deckRevision + 1 }
      : { hands: { ...state.hands, [player]: cards } }),
  });
}
export function deleteNumber(
  state: RoundState,
  player: PlayerId | null,
  instanceId: string,
): RoundState {
  const region = player === null ? state.deck : state.hands[player];
  const instance = region.find((c) => c.instanceId === instanceId);
  // A hand's logical hidden slot stays protected, even after revelation.
  if (
    !instance ||
    (player !== null && state.hiddenCards[player] === instanceId)
  )
    return state;
  const bindings = new Set(
    state.trumps?.table
      .filter((t) => t.cardId === instanceId)
      .map((t) => t.effectId) ?? [],
  );
  return freezeData({
    ...state,
    ...(player === null
      ? {
          deck: state.deck.filter((c) => c.instanceId !== instanceId),
          deckRevision: state.deckRevision + 1,
        }
      : {
          hands: {
            ...state.hands,
            [player]: state.hands[player].filter(
              (c) => c.instanceId !== instanceId,
            ),
          },
        }),
    deletedNumbers: [...state.deletedNumbers, instance],
    ...(state.trumps
      ? {
          trumps: {
            ...state.trumps,
            table: state.trumps.table.filter(
              (t) =>
                !bindings.has(t.effectId) &&
                (!t.targetEffectId || !bindings.has(t.targetEffectId)),
            ),
          },
        }
      : {}),
    lastPlay: null,
  });
}
export function transferNumber(
  state: RoundState,
  from: PlayerId,
  to: PlayerId,
  instanceId: string,
): RoundState {
  if (from === to || state.hiddenCards[from] === instanceId) return state;
  const instance = state.hands[from].find((c) => c.instanceId === instanceId);
  if (!instance) return state;
  return freezeData({
    ...state,
    lastPlay: null,
    hands: {
      ...state.hands,
      [from]: state.hands[from].filter((c) => c.instanceId !== instanceId),
      [to]: [...state.hands[to], instance],
    },
  });
}
