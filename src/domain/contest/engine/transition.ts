// @req REQ-2026-027: skill activation shares the authoritative command boundary without ending the Turn.
// @req REQ-2026-024: resolve draw modifiers and finite Turn boundaries before returning.
// @req REQ-2026-023: numeric contributions, authorized information and reversible effects.
// @req REQ-2026-015/022: authoritative outcomes, including resource grants, precede replay.
import { SKILL_CATALOG } from "../skills/catalog";
import { completeReactionBoundary, passReaction } from "./reactions";
import { playTrump } from "./effects";
import type { TrumpState, SuddenDeathMarker } from "./effectTypes";
import { createTrumpState, grantTrumps } from "./resources";
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { compareTotals } from "./comparison";
import { legalActions, ordinaryHitAvailable } from "./legalActions";
import { ordinaryHit } from "./ordinaryHit";
import { finishTurnSkills } from "./skillTurns";
import { createNumberDeck } from "./numbers";
import { settleRoundSkills } from "./skillSettlement";
import {
  activateSkill,
  startSkillRound,
  pendingSkills,
  updateSkillActivation,
} from "./skills";
import type { SkillState } from "./skillTypes";
import { initialNumberInstances } from "./numberCards";
import { numberRandom, resourceRandom, skillRandom } from "./resourceTypes";
import type {
  ContestRandom,
  ResourceRandomSources,
  SkillRandomSources,
} from "./resourceTypes";
import { observeRound } from "./observation";
import { DEFAULT_ROUND_RULES, snapshotRoundRules } from "./rules";
import { nextTurn, opponentOf } from "./turn";
import { beginTurn } from "./triggers";
import type {
  RoundCommand,
  RoundEvent,
  RoundRules,
  RoundState,
  RoundTransition,
} from "./types";

export function createRound(
  firstPlayer: PlayerId,
  random: ContestRandom,
  rules: RoundRules = DEFAULT_ROUND_RULES,
  trumps?: TrumpState,
  numberScope = 1,
  gameStart = false,
  suddenDeath?: SuddenDeathMarker,
  skills?: SkillState,
): RoundTransition {
  if (firstPlayer !== "human" && firstPlayer !== "ai")
    throw new RangeError("Invalid first player");
  const snapshot = snapshotRoundRules(rules);
  if (snapshot.skills) skillRandom(random);
  const policy = snapshot.trumps?.resources;
  const sources = policy ? resourceRandom(random) : undefined;
  const setup =
    trumps ?? (policy ? createTrumpState(snapshot.trumps!) : undefined);
  const startingGame = gameStart || (!!policy && !trumps);
  let state: RoundState = freezeData({
    rules: snapshot,
    ...(setup ? { trumps: setup } : {}),
    ...(suddenDeath ? { suddenDeath } : {}),
    ...(snapshot.skills
      ? { skills: startSkillRound(snapshot.skills, skills, gameStart) }
      : {}),
    firstPlayer,
    phase: "dealing",
    hands: { human: [], ai: [] },
    deck: initialNumberInstances(
      createNumberDeck(numberRandom(random)),
      numberScope,
    ),
    numberScope,
    nextNumberId: 1,
    deletedNumbers: [],
    hiddenCards: { human: null, ai: null },
    lastPlay: null,
    hiddenMultipliers: { human: 1, ai: 1 },
    deckRevision: 0,
    scry: { human: null, ai: null },
    pointTarget: snapshot.pointTarget,
    hitDrawCounts: { human: 1, ai: 1 },
    turn: null,
    quietStays: 0,
    revealed: [],
    result: null,
  });
  const events: RoundEvent[] = [];
  const order = [firstPlayer, opponentOf(firstPlayer)];
  if (policy && startingGame) {
    for (const player of order) {
      const grant = grantTrumps(
        state,
        player,
        policy.gameGrant,
        "game-start",
        sources!.trumpSelection,
      );
      state = grant.state;
      events.push(...grant.events);
    }
  }
  for (let index = 0; index < 2; index++) {
    for (const player of order) {
      const card = state.deck[0];
      const complete = index === 1 && player === order[1] && !policy;
      state = freezeData({
        ...state,
        hands: { ...state.hands, [player]: [...state.hands[player], card] },
        hiddenCards:
          index === 0
            ? { ...state.hiddenCards, [player]: card.instanceId }
            : state.hiddenCards,
        deck: state.deck.slice(1),
        phase: complete ? "acting" : "dealing",
        turn: complete
          ? { player: firstPlayer, number: 1, usedTrump: false }
          : null,
      });
      events.push({ type: "deal", player, card: card.value, index, state });
    }
  }
  if (policy) {
    for (const player of order) {
      const grant = grantTrumps(
        state,
        player,
        policy.roundGrant,
        "round-start",
        sources!.trumpSelection,
      );
      state = grant.state;
      events.push(...grant.events);
    }
    state = freezeData({
      ...state,
      phase: "acting",
      turn: { player: firstPlayer, number: 1, usedTrump: false },
    });
    events[events.length - 1] = { ...events[events.length - 1], state };
  }
  const boundary = beginTurn(state, state.turn!, sources);
  state = boundary.state;
  events.push(...boundary.events);
  events[events.length - 1] = { ...events[events.length - 1], state };
  return completeReactionBoundary({ state, events });
}

export function transition(
  original: RoundState,
  command: RoundCommand,
  random?: ResourceRandomSources & Partial<SkillRandomSources>,
): RoundTransition {
  const result = executeCommand(original, command, random);
  if (
    result.state === original ||
    command.type === "PassReaction" ||
    (command.type === "ActivateSkill" &&
      SKILL_CATALOG[command.skillId].visibility === "secret")
  )
    return result;
  return completeReactionBoundary(result);
}
function executeCommand(
  original: RoundState,
  command: RoundCommand,
  random?: ResourceRandomSources & Partial<SkillRandomSources>,
): RoundTransition {
  if (
    (command.player !== "human" && command.player !== "ai") ||
    !legalActions(observeRound(original, command.player)).includes(command.type)
  )
    return { state: original, events: [] };
  if (command.type === "PassReaction") return passReaction(original, command);
  if (command.type === "ActivateSkill")
    return activateSkill(
      original,
      command,
      observeRound(original, command.player),
      random,
    );
  if (command.type === "PlayTrump")
    return playTrump(
      original,
      command,
      observeRound(original, command.player),
      random,
    );
  const turn = original.turn!;
  if (command.type === "ResolveForcedTurn") {
    if (command.turnNumber !== turn.number || turn.controlledBy === undefined)
      return { state: original, events: [] };
    const entry = pendingSkills(original).find(
      (p) =>
        p.player === turn.controlledBy &&
        p.activation.effect?.type === "mind-grip" &&
        p.activation.effect.targetTurn === turn.number,
    );
    if (!entry) return { state: original, events: [] };
    let state = updateSkillActivation(
      original,
      entry.player,
      entry.activation.sequence,
      { status: "succeeded" },
    );
    const events: RoundEvent[] = [
      {
        type: "skill",
        player: entry.player,
        skillId: "mind-grip",
        public: true,
        status: "succeeded",
        state,
      },
    ];
    for (
      let count = 0;
      count < 3 && ordinaryHitAvailable(observeRound(state, turn.player));
      count++
    ) {
      const hit = ordinaryHit(state, random);
      state = hit.state;
      events.push(...hit.events);
    }
    const stayed = stayTurn(state, random);
    return freezeData({
      state: stayed.state,
      events: [...events, ...stayed.events],
    });
  }
  if (command.type === "Hit") {
    const hit = ordinaryHit(original, random, nextTurn(turn));
    const ended = finishTurnSkills(hit.state, turn);
    const boundary = beginTurn(ended.state, nextTurn(turn), random);
    const events = [...hit.events, ...ended.events, ...boundary.events];
    events[events.length - 1] = {
      ...events[events.length - 1],
      state: boundary.state,
    };
    return freezeData({ state: boundary.state, events });
  }
  return stayTurn(original, random);
}
function stayTurn(
  original: RoundState,
  random?: ResourceRandomSources & Partial<SkillRandomSources>,
): RoundTransition {
  const turn = original.turn!;
  const ended = finishTurnSkills(original, turn);
  const quiet = !turn.usedTrump && !turn.usedSkill;
  const quietStays = quiet ? ((original.quietStays + 1) as 1 | 2) : 0;
  const closing = quietStays === 2;
  let state: RoundState = freezeData({
    ...ended.state,
    phase: closing ? "revealing" : "acting",
    turn: closing ? null : nextTurn(turn),
    quietStays,
    ...(closing ? { lastPlay: null } : {}),
  });
  const events: RoundEvent[] = [
    ...ended.events,
    { type: "stay", player: turn.player, quiet, state },
  ];
  if (closing) {
    for (const player of [state.firstPlayer, opponentOf(state.firstPlayer)]) {
      state = freezeData({
        ...state,
        revealed: state.revealed.includes(player)
          ? state.revealed
          : [...state.revealed, player],
      });
      events.push({
        type: "reveal",
        player,
        card: state.hands[player].find(
          (c) => c.instanceId === state.hiddenCards[player],
        )!.value,
        state,
      });
    }
    const skills = settleRoundSkills(state, random);
    state = skills.state;
    events.push(...skills.events);
    const result = compareTotals(skills.totals, state.pointTarget);
    state = freezeData({ ...state, phase: "settled", result });
    events.push({ type: "settled", result, state });
  }
  if (!closing) {
    const boundary = beginTurn(state, state.turn!, random);
    state = boundary.state;
    events.push(...boundary.events);
    events[events.length - 1] = { ...events[events.length - 1], state };
  }
  return freezeData({ state, events });
}
