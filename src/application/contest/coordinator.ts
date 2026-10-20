// @req REQ-2026-017/019: private authority and shared replay for normal/scripted consumers.
import {
  createMatch,
  legalMatchActions,
  observeMatch,
  projectMatchTransition,
  transitionMatch,
  type MatchState,
  type MatchTransition,
  type MatchEventView,
  type RoundCommand,
  type RoundRules,
  type TrumpSetup,
} from "../../domain/contest/engine";
import { placeholderOpponent } from "./placeholderOpponent";
import type {
  ContestControllerOptions,
  ContestView,
  OpponentAction,
} from "./types";

import type { PlayerId } from "../../domain/contest/types";
export interface ContestCoordinatorOptions extends ContestControllerOptions {
  readonly roundRules?: RoundRules;
  readonly trumpSetup?: TrumpSetup;
  readonly controlledPlayers?: readonly PlayerId[];
}
export function createContestCoordinator(
  options: ContestCoordinatorOptions = {},
) {
  const random = options.random ?? Math.random;
  const opponent = options.opponent ?? placeholderOpponent;
  const controlled = options.controlledPlayers ?? ["human"];
  const listeners = new Set<() => void>();
  let current: MatchState | null = null;
  let generation = 0;
  let effectId = 0;
  let replaying = false;
  let thinking = false;
  let paused = false;
  let reducedMotion = options.reducedMotion ?? false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let view: ContestView = Object.freeze({
    match: null,
    busy: false,
    thinking: false,
    paused: false,
    event: null,
    effectId: 0,
    actions: Object.freeze([]),
  });

  function publish(match = view.match, event: MatchEventView | null = null) {
    const busy = replaying || thinking;
    view = Object.freeze({
      match,
      busy,
      thinking,
      paused,
      event,
      effectId,
      actions: Object.freeze(
        current && !busy && !paused
          ? [...legalMatchActions(observeMatch(current, "human"))]
          : [],
      ),
    });
    for (const listener of listeners) listener();
  }

  function cancelPending() {
    generation++;
    clearTimeout(timer);
    timer = undefined;
    replaying = false;
    thinking = false;
  }

  const aiTurn = () =>
    current?.phase === "playing" && current.round.turn?.player === "ai";

  function scheduleOpponent() {
    if (
      !current ||
      paused ||
      replaying ||
      thinking ||
      !aiTurn() ||
      controlled.includes("ai")
    )
      return;
    thinking = true;
    const id = generation;
    publish();
    if (id !== generation) return;
    timer = setTimeout(() => {
      if (id !== generation) return;
      timer = undefined;
      thinking = false;
      if (!current || paused || !aiTurn()) return;
      const observation = observeMatch(current, "ai");
      const actions = legalMatchActions(observation).filter(
        (action): action is OpponentAction =>
          action === "Hit" || action === "Stay",
      );
      const type = opponent(observation, actions);
      const result = transitionMatch(
        current,
        {
          type,
          player: "ai",
          roundNumber: current.roundNumber,
        },
        random,
      );
      if (result.state === current) {
        publish(observeMatch(current, "human"));
        return;
      }
      commit(result);
    }, 300);
  }

  function ready() {
    replaying = false;
    publish(current ? observeMatch(current, "human") : null);
    // An event is not a turn: always read the committed actor after replay.
    scheduleOpponent();
  }

  function commit(result: MatchTransition, resetView = false) {
    cancelPending();
    current = result.state;
    const projected = projectMatchTransition(result, "human");
    if (!projected.events.length) {
      ready();
      return;
    }
    replaying = true;
    const id = generation;
    let index = 0;
    publish(resetView ? null : view.match);
    const step = () => {
      if (id !== generation) return;
      timer = undefined;
      const event = projected.events[index++];
      if (!event) {
        ready();
        return;
      }
      effectId++;
      publish(event.state, event);
      if (id !== generation) return;
      options.onEvent?.(event);
      if (id !== generation) return;
      const card =
        event.type === "round" &&
        (event.event.type === "deal" || event.event.type === "hit");
      timer = setTimeout(step, reducedMotion ? 35 : card ? 220 : 300);
    };
    step();
  }

  function begin() {
    paused = false;
    commit(createMatch(random, options.roundRules, options.trumpSetup), true);
  }

  return {
    getSnapshot: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Authoritative human observation, useful for results; never a full state. */
    snapshot: () => (current ? observeMatch(current, "human") : null),
    start() {
      if (current) return false;
      begin();
      return true;
    },
    restart: begin,
    exit() {
      cancelPending();
      current = null;
      paused = false;
      publish(null);
    },
    sendCommand(action: RoundCommand | { readonly type: "NextRound" }) {
      if (!current || replaying || thinking || paused) return false;
      if (action.type !== "NextRound" && !controlled.includes(action.player))
        return false;
      const result = transitionMatch(
        current,
        { ...action, roundNumber: current.roundNumber },
        random,
      );
      if (result.state === current) return false;
      commit(result);
      return true;
    },
    skipAnimations() {
      if (!replaying) return;
      cancelPending();
      ready();
    },
    pause() {
      if (!current || paused) return;
      cancelPending();
      paused = true;
      publish(observeMatch(current, "human"));
    },
    resume() {
      if (!paused) return;
      paused = false;
      ready();
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
    },
  };
}
