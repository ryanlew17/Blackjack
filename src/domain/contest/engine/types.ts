// @req REQ-2026-015: authoritative round data stays inside the engine boundary.
import type { NumberValue, PlayerId } from "../types";

export interface RoundRules {
  readonly version: 1;
  readonly pointTarget: number;
}
export interface TurnState {
  readonly player: PlayerId;
  readonly number: number;
  readonly usedTrump: boolean;
}
export interface RoundResult {
  readonly winner: PlayerId | null;
  readonly totals: Readonly<Record<PlayerId, number>>;
  readonly pointTarget: number;
}
export type RoundPhase = "dealing" | "acting" | "revealing" | "settled";
export interface RoundState {
  readonly rules: RoundRules;
  readonly firstPlayer: PlayerId;
  readonly phase: RoundPhase;
  readonly hands: Readonly<Record<PlayerId, readonly NumberValue[]>>;
  /** Ordered draw pile, with the next card at index zero. Never project it. */
  readonly deck: readonly NumberValue[];
  readonly pointTarget: number;
  readonly turn: TurnState | null;
  readonly quietStays: 0 | 1 | 2;
  readonly revealed: readonly PlayerId[];
  readonly result: RoundResult | null;
}
export interface RoundCommand {
  readonly type: "Hit" | "Stay";
  readonly player: PlayerId;
}
export type RoundEvent = (
  | {
      readonly type: "deal";
      readonly player: PlayerId;
      readonly card: NumberValue;
      readonly index: number;
    }
  | {
      readonly type: "hit";
      readonly player: PlayerId;
      readonly card: NumberValue;
    }
  | {
      readonly type: "reveal";
      readonly player: PlayerId;
      readonly card: NumberValue;
    }
  | {
      readonly type: "stay";
      readonly player: PlayerId;
      readonly quiet: boolean;
    }
  | { readonly type: "settled"; readonly result: RoundResult }
) & { readonly state: RoundState };
export interface RoundTransition {
  readonly state: RoundState;
  readonly events: readonly RoundEvent[];
}

/** No opponent total/bust flag or draw-pile identity exists before revelation. */
export interface NumberCardView {
  readonly value: NumberValue | null;
  readonly faceDown: boolean;
}
export interface RoundHandView {
  readonly cards: readonly NumberCardView[];
  readonly visibleTotal: number;
  readonly total: number | null;
}
export interface RoundObservation {
  readonly viewer: PlayerId;
  readonly rules: RoundRules;
  readonly firstPlayer: PlayerId;
  readonly phase: RoundPhase;
  readonly hands: Readonly<Record<PlayerId, RoundHandView>>;
  readonly deckCount: number;
  readonly pointTarget: number;
  readonly turn: TurnState | null;
  readonly quietStays: 0 | 1 | 2;
  readonly result: RoundResult | null;
}
export type RoundEventView = (
  | {
      readonly type: "deal";
      readonly player: PlayerId;
      readonly card: NumberCardView;
      readonly index: number;
    }
  | {
      readonly type: "hit";
      readonly player: PlayerId;
      readonly card: NumberCardView;
    }
  | {
      readonly type: "reveal";
      readonly player: PlayerId;
      readonly card: NumberCardView;
    }
  | {
      readonly type: "stay";
      readonly player: PlayerId;
      readonly quiet: boolean;
    }
  | { readonly type: "settled"; readonly result: RoundResult }
) & { readonly state: RoundObservation };
export interface RoundTransitionView {
  readonly state: RoundObservation;
  readonly events: readonly RoundEventView[];
}
