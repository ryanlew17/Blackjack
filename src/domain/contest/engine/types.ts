// @req REQ-2026-023: numeric contributions, authorized information and reversible effects.
// @req REQ-2026-022: instance identity/resource migration preserves existing rule regressions.
// @req REQ-2026-015: authoritative round data stays inside the engine boundary.
import type {
  PlayTrumpCommand,
  TrumpEventPayload,
  TrumpRules,
  TrumpState,
  TrumpObservation,
  TrumpSetup,
  ResourceEventPayload,
  ResourceEventView,
  SuddenDeathMarker,
  TableEventPayload,
} from "./effectTypes";
import type { NumberInstance, CardTransaction } from "./numberCards";
import type { NumberValue, PlayerId } from "../types";

export interface RoundRules {
  readonly version: 1;
  readonly pointTarget: number;
  readonly trumps?: TrumpRules;
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
  readonly hands: Readonly<Record<PlayerId, readonly NumberInstance[]>>;
  /** Ordered draw pile, with the next card at index zero. Never project it. */
  readonly deck: readonly NumberInstance[];
  readonly numberScope: number;
  readonly nextNumberId: number;
  readonly deletedNumbers: readonly NumberInstance[];
  readonly hiddenCards: Readonly<Record<PlayerId, string | null>>;
  readonly lastPlay: CardTransaction | null;
  readonly hiddenMultipliers: Readonly<Record<PlayerId, 1 | 2>>;
  readonly deckRevision: number;
  readonly scry: Readonly<
    Record<
      PlayerId,
      {
        readonly revision: number;
        readonly cards: readonly NumberInstance[];
      } | null
    >
  >;
  readonly pointTarget: number;
  /** REQ-022 resource hook; REQ-024 supplies card-driven modifiers. */
  readonly hitDrawCounts: Readonly<Record<PlayerId, 1 | 2>>;
  readonly turn: TurnState | null;
  readonly quietStays: 0 | 1 | 2;
  readonly revealed: readonly PlayerId[];
  readonly result: RoundResult | null;
  readonly trumps?: TrumpState;
  readonly suddenDeath?: SuddenDeathMarker;
}
export type RoundCommand =
  | {
      readonly type: "Hit" | "Stay";
      readonly player: PlayerId;
    }
  | PlayTrumpCommand;
export type RoundEvent = (
  | TrumpEventPayload
  | ResourceEventPayload
  | TableEventPayload
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
  readonly faceUpCardIds: Readonly<Record<PlayerId, readonly string[]>>;
  readonly hiddenMultipliers: Readonly<Record<PlayerId, 1 | 2>>;
  readonly peek: readonly NumberValue[] | null;
  readonly pointTarget: number;
  /** REQ-022 resource hook; REQ-024 supplies card-driven modifiers. */
  readonly hitDrawCounts: Readonly<Record<PlayerId, 1 | 2>>;
  readonly turn: TurnState | null;
  readonly quietStays: 0 | 1 | 2;
  readonly result: RoundResult | null;
  readonly lastPlay: {
    readonly type: "number" | "trump";
    readonly player: PlayerId;
    readonly instanceId: string;
  } | null;
  readonly trumps?: TrumpObservation;
  readonly suddenDeath?: SuddenDeathMarker;
  /** Public capacity feasibility for each of the viewer's own possible payments; no inverse identities. */
  readonly undoableTrumpIds?: readonly string[];
}
export type RoundEventView = (
  | TrumpEventPayload
  | ResourceEventView
  | TableEventPayload
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

// @req REQ-2026-016: fixed standard, no-trump match lifecycle.
export type PlayerScores = Readonly<Record<PlayerId, number>>;
export interface RoundScore {
  readonly base: 0 | 1;
  readonly attack: number;
  readonly defense: number;
  readonly bonus: number;
  readonly ceasefire: boolean;
  readonly guarded: boolean;
  readonly increment: number;
  readonly modifiers: readonly {
    readonly effectId: string;
    readonly owner: PlayerId;
    readonly amount: number;
  }[];
}
export interface MatchRules {
  readonly version: 1;
  readonly difficulty: "standard";
  readonly bestOf: 5;
  readonly gamesToWin: 3;
  readonly initialGameTarget: 5;
  readonly targetIncrement: 2;
  readonly trumpDealing: boolean;
  readonly round: RoundRules;
}
export interface ContestGameState {
  readonly number: number;
  readonly points: PlayerScores;
  readonly target: number;
  readonly roundsPlayed: number;
  /** REQ-024 supplies the actual sudden-death command semantics. */
  readonly suddenDeath?: SuddenDeathMarker;
  readonly winner: PlayerId | null;
}
export type MatchPhase =
  "playing" | "resolving" | "round-complete" | "game-complete" | "complete";
export interface MatchState {
  readonly rules: MatchRules;
  readonly phase: MatchPhase;
  readonly wins: PlayerScores;
  readonly game: ContestGameState;
  /** Global, increasing across games; identifies the command's current round. */
  readonly roundNumber: number;
  readonly round: RoundState;
  /** Private, fixed setup for the next Game; never part of an observation. */
  readonly trumpSetup?: TrumpSetup;
  readonly winner: PlayerId | null;
}
export type MatchCommand = (RoundCommand | { readonly type: "NextRound" }) & {
  readonly roundNumber: number;
};
export type MatchEvent = (
  | { readonly type: "round"; readonly event: RoundEvent }
  | {
      readonly type: "round-scored";
      readonly winner: PlayerId | null;
      readonly score: RoundScore;
    }
  | {
      readonly type: "target-extended";
      readonly from: number;
      readonly to: number;
    }
  | { readonly type: "round-cleanup" }
  | { readonly type: "game-won"; readonly winner: PlayerId }
  | { readonly type: "game-cleanup" }
  | { readonly type: "match-won"; readonly winner: PlayerId }
) & { readonly state: MatchState };
export interface MatchTransition {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
}
export interface MatchObservation {
  readonly rules: MatchRules;
  readonly phase: MatchPhase;
  readonly wins: PlayerScores;
  readonly game: ContestGameState;
  readonly roundNumber: number;
  readonly round: RoundObservation;
  readonly winner: PlayerId | null;
}
export type MatchEventView = (
  | { readonly type: "round"; readonly event: RoundEventView }
  | {
      readonly type: "round-scored";
      readonly winner: PlayerId | null;
      readonly score: RoundScore;
    }
  | {
      readonly type: "target-extended";
      readonly from: number;
      readonly to: number;
    }
  | { readonly type: "round-cleanup" }
  | { readonly type: "game-won"; readonly winner: PlayerId }
  | { readonly type: "game-cleanup" }
  | { readonly type: "match-won"; readonly winner: PlayerId }
) & { readonly state: MatchObservation };
export interface MatchTransitionView {
  readonly state: MatchObservation;
  readonly events: readonly MatchEventView[];
}
