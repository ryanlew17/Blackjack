// @req REQ-2026-023: deterministic fixtures only; never a production entry.
import { freezeData } from "../immutable";
import type { NumberValue, PlayerId } from "../types";
import { NUMBER_TRUMP_DEFINITIONS } from "../trumps/numberDefinitions";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  legalTrumpCommands,
} from "./index";
import type {
  MatchState,
  MatchTransition,
  ContestRandomSources,
  PlayTrumpCommand,
  RoundRules,
} from "./index";
import { fixedRandom } from "./testHelpers";
export const NUMERIC_RULES: RoundRules = freezeData({
  version: 1,
  pointTarget: 21,
  trumps: {
    tableCapacity: 5,
    definitions: {
      ...NUMBER_TRUMP_DEFINITIONS,
      filler: { onPlay: [], table: { pointTarget: null } },
      fee: { onPlay: [] },
      mixed: {
        cost: 1,
        onPlay: [
          { type: "draw-number", value: 2 },
          { type: "grant-trumps", target: "self", count: 2 },
        ],
        table: { pointTarget: 24 },
      },
      supply: { onPlay: [{ type: "grant-trumps", target: "self", count: 2 }] },
      creator: { onPlay: [{ type: "generate-number", value: 1 }] },
      eraser: { onPlay: [{ type: "delete-last-number", target: "self" }] },
      "trump-maker": {
        onPlay: [{ type: "generate-trump", definitionId: "regret" }],
      },
      pressure: { onPlay: [], table: { pointTarget: null } },
      "pressure-supply": {
        onPlay: [{ type: "draw-number", value: 3 }],
        table: { pointTarget: null },
      },
      shield: { onPlay: [], table: { pointTarget: null } },
      "full-shield": { onPlay: [], table: { pointTarget: null } },
      "last-stand": { onPlay: [], table: { pointTarget: null } },
      "risk-pledge": { onPlay: [], table: { pointTarget: null } },
      harvest: {
        onPlay: [],
        table: { pointTarget: null, remainingCharges: 2 },
      },
      "supply-cache": {
        onPlay: [],
        table: { pointTarget: null, remainingCharges: 1 },
      },
      hush: { onPlay: [], table: { pointTarget: null } },
    },
  },
});
export const noRandom = () => {
  throw new Error("A card command consumed number randomness");
};
export function numericFixture(
  human: readonly string[],
  ai: readonly string[] = [],
  prefix: readonly NumberValue[] = [10, 8, 11, 9],
): MatchState {
  const shuffle = fixedRandom(prefix);
  let coin = true;
  return createMatch(
    () => (coin ? ((coin = false), 0.25) : shuffle()),
    NUMERIC_RULES,
    {
      human: human.map((definitionId, i) => ({
        definitionId,
        instanceId: "human-" + i,
      })),
      ai: ai.map((definitionId, i) => ({
        definitionId,
        instanceId: "ai-" + i,
      })),
    },
  ).state;
}
export function execute(
  state: MatchState,
  command: Omit<PlayTrumpCommand, "player">,
  random: ContestRandomSources | (() => number) = noRandom,
): MatchTransition {
  return transitionMatch(
    state,
    {
      ...command,
      player: state.round.turn!.player,
      roundNumber: state.roundNumber,
    },
    random,
  );
}
export function numericPlay(
  state: MatchState,
  id: string,
  options: Partial<PlayTrumpCommand> = {},
  random: ContestRandomSources | (() => number) = noRandom,
): MatchTransition {
  const player = state.round.turn!.player;
  const card = state.round.trumps!.hands[player].find(
    (c) => c.definitionId === id,
  );
  if (!card) throw new Error("Missing test card " + id);
  const legal = legalTrumpCommands(observeMatch(state, player).round).find(
    (c) => c.instanceId === card.instanceId,
  );
  return execute(
    state,
    {
      ...(legal ?? { type: "PlayTrump", instanceId: card.instanceId }),
      ...options,
    },
    random,
  );
}
export function numericAct(
  state: MatchState,
  type: "Hit" | "Stay",
  random: ContestRandomSources | (() => number) = noRandom,
): MatchTransition {
  return transitionMatch(
    state,
    { type, player: state.round.turn!.player, roundNumber: state.roundNumber },
    random,
  );
}
export function numericFinish(
  state: MatchState,
  random: ContestRandomSources | (() => number) = noRandom,
): MatchState {
  for (let i = 0; i < 4 && state.phase === "playing"; i++)
    state = numericAct(state, "Stay", random).state;
  if (state.phase === "playing") throw new Error("Fixture did not settle");
  return state;
}
export function emptyNumbers(
  state: MatchState,
  actor: PlayerId = "human",
): MatchState {
  while (state.round.deck.length) state = numericAct(state, "Hit").state;
  if (state.round.turn!.player !== actor)
    state = numericAct(state, "Stay").state;
  return state;
}
export const values = (state: MatchState, player: PlayerId) =>
  state.round.hands[player].map((c) => c.value);
