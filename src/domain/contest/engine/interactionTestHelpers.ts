// @req REQ-2026-024: isolated arrangements of real stock identities; all actions use transitionMatch.
import { freezeData } from "../immutable";
import type { NumberValue, PlayerId } from "../types";
import { NUMBER_TRUMP_DEFINITIONS } from "../trumps/numberDefinitions";
import { INTERACTION_TRUMP_DEFINITIONS } from "../trumps/interactionDefinitions";
import { createTrumpState } from "./resources";
import {
  createMatch,
  transitionMatch,
  legalTrumpCommands,
  observeMatch,
  drawTrump,
} from "./index";
import type {
  MatchState,
  MatchTransition,
  RoundRules,
  PlayTrumpCommand,
  ContestRandomSources,
} from "./index";
import { fixedRandom } from "./testHelpers";
export const DEFINITIONS = freezeData({
  ...NUMBER_TRUMP_DEFINITIONS,
  ...INTERACTION_TRUMP_DEFINITIONS,
});
const streams = () => ({
  numbers: () => {
    throw new Error("Unexpected number RNG");
  },
  trumpGate: () => 0,
  trumpSelection: () => 0,
});
export function fixture(
  human: readonly string[] = [],
  ai: readonly string[] = [],
  prefix: readonly NumberValue[] = [10, 8, 11, 9],
  remaining: Readonly<Record<string, number>> = { pressure: 12 },
): MatchState {
  const stock: Record<string, number> = { ...remaining };
  for (const id of [...human, ...ai]) stock[id] = (stock[id] ?? 0) + 1;
  const rules: RoundRules = {
    version: 1,
    pointTarget: 21,
    trumps: {
      tableCapacity: 5,
      definitions: DEFINITIONS,
      resources: {
        difficulty: "standard",
        handLimit: 8,
        gameGrant: 2,
        roundGrant: 1,
        hitProbability: 0.3,
        stock,
      },
    },
  };
  const shuffle = fixedRandom(prefix);
  let coin = true;
  const state = createMatch(
    {
      numbers: () => (coin ? ((coin = false), 0.25) : shuffle()),
      trumpGate: () => 0,
      trumpSelection: () => 0,
    },
    rules,
  ).state;
  // Reset only the fixture's initial resource arrangement, preserving actual stock origins/quotas.
  let trumps = createTrumpState(state.rules.round.trumps!);
  for (const player of ["human", "ai"] as const)
    for (const id of player === "human" ? human : ai) {
      const grant = drawTrump(trumps, player, undefined, id);
      if (!grant.instance) throw new Error("Fixture capacity/stock");
      trumps = grant.state;
    }
  return freezeData({ ...state, round: { ...state.round, trumps } });
}
export function play(
  state: MatchState,
  id: string,
  options: Partial<PlayTrumpCommand> = {},
  random: ContestRandomSources = streams(),
): MatchTransition {
  const player = state.round.turn!.player,
    instance = state.round.trumps!.hands[player].find(
      (c) => c.definitionId === id,
    );
  if (!instance) throw new Error("Missing test card " + id);
  const command = legalTrumpCommands(observeMatch(state, player).round).find(
    (c) => c.instanceId === instance.instanceId,
  );
  return transitionMatch(
    state,
    {
      ...(command ?? {
        type: "PlayTrump",
        player,
        instanceId: instance.instanceId,
      }),
      ...options,
      roundNumber: state.roundNumber,
    },
    random,
  );
}
export function act(
  state: MatchState,
  type: "Hit" | "Stay",
  random: ContestRandomSources = streams(),
): MatchTransition {
  return transitionMatch(
    state,
    { type, player: state.round.turn!.player, roundNumber: state.roundNumber },
    random,
  );
}
export function finish(
  state: MatchState,
  random: ContestRandomSources = streams(),
): MatchTransition {
  const events: MatchTransition["events"][number][] = [];
  for (let i = 0; i < 4 && state.phase === "playing"; i++) {
    const result = act(state, "Stay", random);
    state = result.state;
    events.push(...result.events);
  }
  if (state.phase === "playing") throw new Error("Fixture did not settle");
  return { state, events };
}
export function prepare(
  human: readonly string[],
  ai: readonly string[] = [],
  prefix?: readonly NumberValue[],
): MatchState {
  let state = fixture(human, ai, prefix);
  for (const id of human) state = play(state, id).state;
  state = act(state, "Stay").state;
  for (const id of ai) state = play(state, id).state;
  if (ai.length) state = act(state, "Stay").state;
  return state;
}
/** No test-runner import: domain helpers obey the same dependency/purity guard as the engine. */
export function ledger(result: MatchTransition) {
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error("Fixture ledger: " + message);
  };
  for (const state of [result.state, ...result.events.map((e) => e.state)]) {
    const round = state.round,
      trumps = round.trumps!;
    const numbers = [
      ...round.deck,
      ...round.hands.human,
      ...round.hands.ai,
      ...round.deletedNumbers,
    ];
    check(
      new Set(numbers.map((c) => c.instanceId)).size === numbers.length,
      "duplicate number identity",
    );
    check(
      numbers.filter((c) => c.origin.type === "initial").length === 11,
      "initial number conservation",
    );
    check(
      numbers.filter((c) => c.origin.type === "generated").length ===
        round.nextNumberId - 1,
      "generated number conservation",
    );
    const bodies = [
      ...trumps.stock.human,
      ...trumps.stock.ai,
      ...trumps.hands.human,
      ...trumps.hands.ai,
      ...trumps.destroyed.map((d) => d.instance),
    ];
    check(
      new Set(bodies.map((c) => c.instanceId)).size === bodies.length,
      "duplicate trump identity",
    );
    if (!bodies.length) continue; // Game cleanup discards the entire old ledger.
    for (const player of ["human", "ai"] as const) {
      check(trumps.hands[player].length <= 8, "hand capacity");
      check(
        trumps.table.filter((t) => t.owner === player).length <= 5,
        "table capacity",
      );
      check(
        bodies.filter(
          (c) => c.origin.type === "stock" && c.origin.owner === player,
        ).length ===
          Object.values(state.rules.round.trumps!.resources!.stock).reduce(
            (n, c) => n + c,
            0,
          ),
        "original stock conservation",
      );
    }
    for (const t of trumps.table)
      check(
        trumps.destroyed.some(
          (d) =>
            d.reason === "played" &&
            d.instance.instanceId === t.sourceInstanceId,
        ),
        "effect source was not consumed",
      );
  }
}

export const hand = (s: MatchState, p: PlayerId = "human") =>
  s.round.trumps!.hands[p];
export const table = (s: MatchState, id: string) =>
  s.round.trumps!.table.filter((t) => t.definitionId === id);
