// @req REQ-2026-027: opt-in skill matches require independent default random streams.
// @req REQ-2026-017/019/025: private authority and shared replay for normal/scripted consumers.
import {
  createMatch,
  legalMatchActions,
  legalTrumpCommands,
  legalSkillCommands,
  observeMatch,
  projectMatchTransition,
  transitionMatch,
  type MatchState,
  type MatchCommand,
  type MatchTransition,
  type MatchEventView,
  type RoundCommand,
  type RoundRules,
  type TrumpSetup,
} from "../../domain/contest/engine";
import { freezeData } from "../../domain/contest/immutable";
import { createContestRandomSources, createSearchSeedSource } from "./random";
import {
  createBeliefMemory,
  advanceBeliefMemory,
  type BeliefMemory,
} from "../../domain/contest/ai/memory";
import { baselinePolicy } from "../../domain/contest/ai/policy";
import type {
  ContestControllerOptions,
  ContestView,
  OpponentAction,
} from "./types";

import type { PlayerId } from "../../domain/contest/types";
export interface ContestCoordinatorOptions extends Omit<
  ContestControllerOptions,
  "preset"
> {
  readonly roundRules?: RoundRules;
  readonly trumpSetup?: TrumpSetup;
  readonly controlledPlayers?: readonly PlayerId[];
}
export function createContestCoordinator(
  options: ContestCoordinatorOptions = {},
) {
  const random =
    options.random ??
    (options.roundRules?.trumps?.resources || options.roundRules?.skills
      ? createContestRandomSources()
      : Math.random);
  const opponent = options.opponent ?? baselinePolicy;
  const controlled = options.controlledPlayers ?? ["human"];
  const listeners = new Set<() => void>();
  let current: MatchState | null = null;
  let aiMemory: BeliefMemory | null = null;
  const nextSearchSeed = options.searchSeed ?? createSearchSeedSource();
  let cancelDecision: (() => void) | undefined;
  let visible = true;
  let generation = 0;
  let effectId = 0;
  let recentEvents: MatchEventView[] = [];
  let pendingEvents: MatchEventView[] = [];
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
    inputId: 0,
    recentEvents: Object.freeze([]),
    trumpCommands: Object.freeze([]),
    skillCommands: Object.freeze([]),
    reaction: null,
    actions: Object.freeze([]),
  });

  function publish(match = view.match, event: MatchEventView | null = null) {
    const busy = replaying || thinking;
    const actionable =
      current && !busy && !paused && visible
        ? observeMatch(current, "human")
        : null;
    const reaction = actionable?.round.reaction;
    const skills = actionable ? legalSkillCommands(actionable.round) : [];
    const activate = reaction?.player === "human" ? skills[0] : undefined;
    view = Object.freeze({
      match,
      busy,
      thinking,
      paused,
      event,
      effectId,
      inputId: generation,
      recentEvents: Object.freeze([...recentEvents]),
      reaction:
        reaction && activate
          ? freezeData({
              activate: { ...activate, inputId: generation },
              pass: {
                type: "PassReaction" as const,
                player: "human" as const,
                turnNumber: reaction.turnNumber,
                reactionBoundary: reaction.boundary,
                inputId: generation,
              },
            })
          : null,
      actions: Object.freeze(
        actionable
          ? legalMatchActions(actionable).filter(
              (action) => action !== "ResolveForcedTurn",
            )
          : [],
      ),
      skillCommands: freezeData(
        skills.map(({ player: _player, ...command }) => ({
          ...command,
          inputId: generation,
        })),
      ),
      trumpCommands: freezeData(
        actionable
          ? legalTrumpCommands(actionable.round).map(
              ({ player: _player, ...command }) => ({
                ...command,
                inputId: generation,
              }),
            )
          : [],
      ),
    });
    for (const listener of listeners) listener();
  }

  function remember(event: MatchEventView) {
    recentEvents = [...recentEvents.slice(-47), event];
  }
  function finishFeedback() {
    for (const event of pendingEvents) remember(event);
  }
  function cancelPending() {
    generation++;
    cancelDecision?.();
    cancelDecision = undefined;
    clearTimeout(timer);
    timer = undefined;
    pendingEvents = [];
    replaying = false;
    thinking = false;
  }

  const aiDecision = () => {
    if (current?.phase !== "playing") return false;
    const view = observeMatch(current, "ai").round;
    return view.reaction
      ? view.reaction.player === "ai"
      : view.turn?.player === "ai" && view.turn.controlledBy === undefined;
  };

  // Human and AI secret reactions use the same atomic activation+pass submission.
  function submit(command: MatchCommand): boolean {
    if (!current) return false;
    const result = transitionMatch(current, command, random);
    if (result.state === current) return false;
    if (command.type === "ActivateSkill" && command.skillId === "twin-bloom") {
      const passed = transitionMatch(
        result.state,
        {
          type: "PassReaction",
          player: command.player,
          turnNumber: command.turnNumber,
          reactionBoundary: command.reactionBoundary!,
          roundNumber: current.roundNumber,
        },
        random,
      );
      commit({ state: passed.state, events: result.events });
    } else commit(result);
    return true;
  }

  function scheduleOpponent() {
    if (
      !current ||
      paused ||
      !visible ||
      replaying ||
      thinking ||
      !aiDecision() ||
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
      if (!current || paused || !visible || !aiDecision()) return;
      const expected = current;
      let completed = false;
      const deliver = (command: MatchCommand | null) => {
        if (
          completed ||
          id !== generation ||
          current !== expected ||
          paused ||
          !visible ||
          !thinking
        )
          return;
        completed = true;
        thinking = false;
        cancelDecision = undefined;
        if (
          !command ||
          command.type === "NextRound" ||
          command.type === "ResolveForcedTurn" ||
          command.player !== "ai" ||
          command.roundNumber !== current.roundNumber ||
          !submit(command)
        )
          publish(observeMatch(current, "human"));
      };
      if (options.decision) {
        const cancel = options.decision(aiMemory!, nextSearchSeed(), deliver);
        // Injected tasks can deliver synchronously or invalidate the coordinator during setup.
        if (completed || id !== generation) cancel();
        else cancelDecision = cancel;
      } else {
        const observation = observeMatch(current, "ai");
        const actions = legalMatchActions(observation).filter(
          (action): action is OpponentAction =>
            action === "Hit" || action === "Stay",
        );
        const type = opponent(observation, actions);
        deliver({ type, player: "ai", roundNumber: expected.roundNumber });
      }
    }, 300);
  }

  function ready() {
    replaying = false;
    // Human cover windows and legacy baseline reactions silently pass when appropriate.
    // Async AI always enters the common decision boundary, even if only Pass is legal.
    const reaction = current
      ? observeMatch(current, "human").round.reaction
      : undefined;
    if (current && reaction && !paused && visible) {
      if (
        reaction.player === "ai" &&
        !controlled.includes("ai") &&
        options.decision
      ) {
        scheduleOpponent();
        return;
      }
      const canActivate =
        legalSkillCommands(observeMatch(current, reaction.player).round)
          .length > 0;
      if (
        !canActivate ||
        (reaction.player === "ai" && !controlled.includes("ai"))
      ) {
        const result = transitionMatch(
          current,
          {
            type: "PassReaction",
            player: reaction.player,
            turnNumber: reaction.turnNumber,
            reactionBoundary: reaction.boundary,
            roundNumber: current.roundNumber,
          },
          random,
        );
        if (result.state !== current) {
          commit(result);
          return;
        }
      }
    }
    const id = generation;
    publish(current ? observeMatch(current, "human") : null);
    if (id !== generation || paused || !visible) return;
    // A pending explicit reaction gates both ordinary AI and the entire forced continuation.
    if (current && observeMatch(current, "human").round.reaction) return;
    // The controlled command remains atomic after this stable authorization boundary.
    // A controlled Turn bypasses the decision policy and commits every Hit/Stay before replay.
    const turn = current?.round.turn;
    if (current?.phase === "playing" && turn?.controlledBy !== undefined) {
      const result = transitionMatch(
        current,
        {
          type: "ResolveForcedTurn",
          player: turn.player,
          turnNumber: turn.number,
          roundNumber: current.roundNumber,
        },
        random,
      );
      if (result.state !== current) commit(result);
      return;
    }
    // An event is not a turn: always read the committed actor after replay.
    scheduleOpponent();
  }

  function commit(result: MatchTransition, resetView = false) {
    cancelPending();
    if (current?.roundNumber !== result.state.roundNumber) recentEvents = [];
    current = result.state;
    if (options.decision) {
      const authorized = projectMatchTransition(result, "ai");
      aiMemory =
        resetView || !aiMemory
          ? createBeliefMemory(authorized)
          : advanceBeliefMemory(aiMemory, authorized);
    }
    const projected = projectMatchTransition(result, "human");
    if (!projected.events.length) {
      ready();
      return;
    }
    replaying = true;
    const id = generation;
    pendingEvents = [...projected.events];
    publish(resetView ? null : view.match);
    const step = () => {
      if (id !== generation) return;
      timer = undefined;
      const event = pendingEvents.shift();
      if (!event) {
        ready();
        return;
      }
      effectId++;
      remember(event);
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

  function begin(roundRules = options.roundRules) {
    recentEvents = [];
    paused = false;
    commit(createMatch(random, roundRules, options.trumpSetup), true);
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
    start(roundRules = options.roundRules) {
      if (current) return false;
      begin(roundRules);
      return true;
    },
    restart: begin,
    exit() {
      cancelPending();
      current = null;
      aiMemory = null;
      recentEvents = [];
      paused = false;
      publish(null);
    },
    sendCommand(
      action: (RoundCommand | { readonly type: "NextRound" }) & {
        readonly inputId?: number;
      },
    ) {
      if (!current || replaying || thinking || paused || !visible) return false;
      if (
        (action.type === "PassReaction" ||
          (action.type === "ActivateSkill" &&
            (action.skillId === "twin-bloom" ||
              action.inputId !== undefined))) &&
        action.inputId !== generation
      )
        return false;
      if (action.type !== "NextRound" && !controlled.includes(action.player))
        return false;
      return submit({ ...action, roundNumber: current.roundNumber });
    },
    setVisible(value: boolean) {
      if (visible === value) return;
      visible = value;
      finishFeedback();
      cancelPending();
      if (value) ready();
      else publish(current ? observeMatch(current, "human") : null);
    },

    skipAnimations() {
      if (!current) return;
      // Visibility/skip also invalidates idle target selections and pending AI decisions.
      finishFeedback();
      cancelPending();
      ready();
    },
    pause() {
      if (!current || paused) return;
      finishFeedback();
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
