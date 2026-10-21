// @req REQ-2026-023: numeric contributions, authorized information and reversible effects.
// @req REQ-2026-015/022: authoritative outcomes, including resource grants, precede replay.
import { playTrump } from "./effects";
import type { TrumpState } from "./effectTypes";
import { createTrumpState, grantTrumps } from "./resources";
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { compareTotals } from "./comparison";
import { effectiveTotals } from "./contributions";
import { legalActions } from "./legalActions";
import { createNumberDeck, randomUnit } from "./numbers";
import { initialNumberInstances } from "./numberCards";
import { numberRandom, resourceRandom } from "./resourceTypes";
import type { ContestRandom, ResourceRandomSources } from "./resourceTypes";
import { observeRound } from "./observation";
import { DEFAULT_ROUND_RULES, snapshotRoundRules } from "./rules";
import { nextTurn, opponentOf } from "./turn";
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
): RoundTransition {
  if (firstPlayer !== "human" && firstPlayer !== "ai")
    throw new RangeError("Invalid first player");
  const snapshot = snapshotRoundRules(rules);
  const policy = snapshot.trumps?.resources;
  const sources = policy ? resourceRandom(random) : undefined;
  const setup =
    trumps ?? (policy ? createTrumpState(snapshot.trumps!) : undefined);
  const startingGame = gameStart || (!!policy && !trumps);
  let state: RoundState = freezeData({
    rules: snapshot,
    ...(setup ? { trumps: setup } : {}),
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
  return freezeData({ state, events });
}

export function transition(
  original: RoundState,
  command: RoundCommand,
  random?: ResourceRandomSources,
): RoundTransition {
  if (
    (command.player !== "human" && command.player !== "ai") ||
    !legalActions(observeRound(original, command.player)).includes(command.type)
  )
    return { state: original, events: [] };
  if (command.type === "PlayTrump")
    return playTrump(
      original,
      command,
      observeRound(original, command.player),
      random,
    );
  const turn = original.turn!;
  if (command.type === "Hit") {
    const policy = original.rules.trumps?.resources;
    const sources = policy ? resourceRandom(random) : undefined;
    const count = Math.min(
      original.hitDrawCounts[command.player],
      original.deck.length,
    );
    let state = original;
    const events: RoundEvent[] = [];
    for (let index = 0; index < count; index++) {
      const card = state.deck[0];
      state = freezeData({
        ...state,
        hands: {
          ...state.hands,
          [command.player]: [...state.hands[command.player], card],
        },
        deck: state.deck.slice(1),
        deckRevision: state.deckRevision + 1,
        lastPlay: {
          type: "number",
          player: command.player,
          instanceId: card.instanceId,
        },
        turn: index === count - 1 ? nextTurn(turn) : turn,
        quietStays: 0,
      });
      events.push({
        type: "hit",
        player: command.player,
        card: card.value,
        state,
      });
    }
    if (policy && randomUnit(sources!.trumpGate) < policy.hitProbability) {
      const grant = grantTrumps(
        state,
        command.player,
        1,
        "hit",
        sources!.trumpSelection,
      );
      state = grant.state;
      events.push(...grant.events);
    }
    return freezeData({ state, events });
  }
  const quiet = !turn.usedTrump;
  const quietStays = quiet ? ((original.quietStays + 1) as 1 | 2) : 0;
  const closing = quietStays === 2;
  let state: RoundState = freezeData({
    ...original,
    phase: closing ? "revealing" : "acting",
    turn: closing ? null : nextTurn(turn),
    quietStays,
    ...(closing ? { lastPlay: null } : {}),
  });
  const events: RoundEvent[] = [
    { type: "stay", player: command.player, quiet, state },
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
    const result = compareTotals(
      effectiveTotals(state, true),
      state.pointTarget,
    );
    state = freezeData({ ...state, phase: "settled", result });
    events.push({ type: "settled", result, state });
  }
  return freezeData({ state, events });
}
