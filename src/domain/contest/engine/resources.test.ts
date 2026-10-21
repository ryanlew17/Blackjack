// @req REQ-2026-022: real resource transitions, source accounting and private projection.
import { describe, expect, it, vi } from "vitest";
import type { Difficulty, PlayerId } from "../types";
import { freezeData } from "../immutable";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  projectMatchTransition,
  legalTrumpCommands,
  generateNumber,
  deleteNumber,
  transferNumber,
  drawTrump,
  generateTrump,
  deleteTrump,
  deleteStockTrump,
  transferTrump,
  HIT_PROBABILITIES,
} from "./index";
import type {
  ContestRandomSources,
  MatchState,
  MatchTransition,
  RoundRules,
  TrumpRules,
  TrumpState,
  RoundState,
} from "./index";
import { createTrumpState, observeTrumps } from "./resources";
import { fixedRandom } from "./testHelpers";
import { cleanupRound, cleanupGame } from "./lifecycle";

const definitions: TrumpRules["definitions"] = {
  filler: { onPlay: [], table: { pointTarget: null } },
  target: { onPlay: [] },
  drawer: { onPlay: [{ type: "draw-number", value: 2 }] },
  top: { onPlay: [{ type: "draw-top", target: "self", count: 2 }] },
  forced: { onPlay: [{ type: "draw-top", target: "opponent", count: 1 }] },
  returner: { onPlay: [{ type: "return-last" }] },
  supply: { onPlay: [{ type: "grant-trumps", target: "self", count: 2 }] },
  fill: { onPlay: [{ type: "grant-trumps", target: "self", count: 20 }] },
  searcher: {
    onPlay: [
      {
        type: "grant-trumps",
        target: "opponent",
        count: 1,
        definitionId: "target",
      },
    ],
  },
  mixed: {
    onPlay: [{ type: "grant-trumps", target: "self", count: 2 }],
    table: { pointTarget: 24 },
  },
  cost: {
    cost: 1,
    onPlay: [{ type: "grant-trumps", target: "self", count: 2 }],
  },
  creator: { onPlay: [{ type: "generate-trump", definitionId: "target" }] },
  clone: { onPlay: [{ type: "generate-number", value: 1 }] },
  eraser: { onPlay: [{ type: "delete-last-number", target: "self" }] },
};
function rules(
  stock: Record<string, number>,
  difficulty: Difficulty = "standard",
): RoundRules {
  return {
    version: 1,
    pointTarget: 21,
    trumps: {
      tableCapacity: 5,
      definitions,
      resources: {
        difficulty,
        handLimit: 8,
        gameGrant: 2,
        roundGrant: 1,
        hitProbability: HIT_PROBABILITIES[difficulty],
        stock,
      },
    },
  };
}
function streams(
  selection: readonly number[] = [],
  gate = 0,
): ContestRandomSources & {
  numbers: ReturnType<typeof vi.fn>;
  trumpSelection: ReturnType<typeof vi.fn>;
  trumpGate: ReturnType<typeof vi.fn>;
} {
  const values = [0.25];
  for (let round = 0; round < 30; round++) {
    const next = fixedRandom(round % 2 ? [8, 10, 9, 11] : [10, 8, 11, 9]);
    for (let i = 0; i < 10; i++) values.push(next());
  }
  let n = 0,
    s = 0;
  return {
    numbers: vi.fn(() => {
      if (n >= values.length) throw new Error("Unexpected number RNG");
      return values[n++];
    }),
    trumpGate: vi.fn(() => gate),
    trumpSelection: vi.fn(() => selection[s++] ?? 0),
  };
}
function send(
  state: MatchState,
  sources: ContestRandomSources,
  type: "Hit" | "Stay" | "NextRound",
) {
  return transitionMatch(
    state,
    type === "NextRound"
      ? { type, roundNumber: state.roundNumber }
      : {
          type,
          player: state.round.turn!.player,
          roundNumber: state.roundNumber,
        },
    sources,
  );
}
function play(
  state: MatchState,
  sources: ContestRandomSources,
  id: string,
  costIds?: readonly string[],
) {
  const player = state.round.turn!.player;
  const instance = state.round.trumps!.hands[player].find(
    (c) => c.definitionId === id,
  )!;
  expect(instance).toBeDefined();
  return transitionMatch(
    state,
    {
      type: "PlayTrump",
      player,
      instanceId: instance.instanceId,
      ...(costIds ? { costIds } : {}),
      roundNumber: state.roundNumber,
    },
    sources,
  );
}
function finish(state: MatchState, sources: ContestRandomSources): MatchState {
  for (let i = 0; i < 4 && state.phase === "playing"; i++)
    state = send(state, sources, "Stay").state;
  expect(state.phase).not.toBe("playing");
  return state;
}
function numberLedger(state: RoundState) {
  const cards = [
    ...state.deck,
    ...state.hands.human,
    ...state.hands.ai,
    ...state.deletedNumbers,
  ];
  expect(new Set(cards.map((c) => c.instanceId)).size).toBe(cards.length);
  expect(cards.filter((c) => c.origin.type === "initial")).toHaveLength(11);
  expect(cards.filter((c) => c.origin.type === "generated")).toHaveLength(
    state.nextNumberId - 1,
  );
  expect(cards.every((c) => Object.isFrozen(c))).toBe(true);
}
function trumpLedger(state: TrumpState, initial: number) {
  const cards = [
    ...state.stock.human,
    ...state.stock.ai,
    ...state.hands.human,
    ...state.hands.ai,
    ...state.destroyed.map((d) => d.instance),
  ];
  expect(new Set(cards.map((c) => c.instanceId)).size).toBe(cards.length);
  expect(cards.filter((c) => c.origin.type !== "generated")).toHaveLength(
    initial,
  );
  for (const record of state.table) {
    expect(record).not.toHaveProperty("instanceId");
    expect(
      state.destroyed.some(
        (d) =>
          d.reason === "played" &&
          d.instance.instanceId === record.sourceInstanceId,
      ),
    ).toBe(true);
  }
}
function frames(result: MatchTransition, initial: number) {
  for (const state of [result.state, ...result.events.map((e) => e.state)]) {
    expect(Object.isFrozen(state)).toBe(true);
    numberLedger(state.round);
    trumpLedger(state.round.trumps!, initial);
  }
}
function roundResources(result: MatchTransition) {
  return result.events.flatMap((e) =>
    e.type === "round" && e.event.type === "resource" ? [e.event] : [],
  );
}

describe("actual finite stock in match lifecycle", () => {
  it("grants Game two, deals alternate numbers, then Round one in first-player order", () => {
    const sources = streams();
    const result = createMatch(sources, rules({ filler: 20 }));
    frames(result, 40);
    expect(sources.numbers).toHaveBeenCalledTimes(11);
    expect(sources.trumpGate).not.toHaveBeenCalled();
    expect(sources.trumpSelection).toHaveBeenCalledTimes(6);
    expect(
      result.events.map((e) => (e.type === "round" ? e.event.type : e.type)),
    ).toEqual([
      "resource",
      "resource",
      "resource",
      "resource",
      "deal",
      "deal",
      "deal",
      "deal",
      "resource",
      "resource",
    ]);
    expect(roundResources(result).map((e) => [e.cause, e.player])).toEqual([
      ["game-start", "human"],
      ["game-start", "human"],
      ["game-start", "ai"],
      ["game-start", "ai"],
      ["round-start", "human"],
      ["round-start", "ai"],
    ]);
    expect(result.state.round.trumps!.hands.human).toHaveLength(3);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(3);
    expect(result.state.round.trumps!.stock.human).toHaveLength(17);
    expect(result.state.round.turn).toEqual({
      player: "human",
      number: 1,
      usedTrump: false,
    });
    expect(result.events.at(-1)!.state).toEqual(result.state);
    expect(result.events.at(-1)!.state.round).toBe(result.state.round);
    expect(
      result.events.slice(0, -1).every((e) => e.state.round.turn === null),
    ).toBe(true);
    expect(result.state.rules.trumpDealing).toBe(true);
  });
  it("keeps hands and stock across Rounds, but issues new stock and IDs at the next Game", () => {
    const sources = streams();
    let state = createMatch(sources, rules({ filler: 20 })).state;
    const snapshot = state.rules.round;
    const firstIDs = new Set(
      [
        ...state.round.trumps!.hands.human,
        ...state.round.trumps!.stock.human,
      ].map((c) => c.instanceId),
    );
    state = play(state, sources, "filler").state;
    const played = state.round.trumps!.destroyed[0].instance.instanceId;
    state = finish(state, sources);
    expect(state.round.trumps!.table).toEqual([]);
    expect(state.round.trumps!.destroyed[0].instance.instanceId).toBe(played);
    const next = send(state, sources, "NextRound");
    frames(next, 40);
    state = next.state;
    expect(roundResources(next).map((e) => e.player)).toEqual(["ai", "human"]);
    expect(state.round.trumps!.hands.human).toHaveLength(3);
    expect(state.round.trumps!.stock.human).toHaveLength(16);
    expect(state.rules.round).toBe(snapshot);
    expect(state.round.rules).toBe(snapshot);
    for (let i = 0; i < 4; i++) {
      state = finish(state, sources);
      if (state.phase !== "game-complete")
        state = send(state, sources, "NextRound").state;
    }
    expect(state.phase).toBe("game-complete");
    expect(state.round.trumps!.hands).toEqual({ human: [], ai: [] });
    expect(state.round.trumps!.stock).toEqual({ human: [], ai: [] });
    expect(state.round.trumps!.destroyed).toEqual([]);
    expect(state.round.trumps!.table).toEqual([]);
    expect(cleanupGame(cleanupGame(state.round))).toEqual(
      cleanupGame(state.round),
    );
    const fresh = send(state, sources, "NextRound");
    frames(fresh, 40);
    expect(fresh.state.game.number).toBe(2);
    expect(fresh.state.rules.round).toBe(snapshot);
    expect(fresh.state.round.trumps!.hands.human).toHaveLength(3);
    expect(fresh.state.round.trumps!.stock.human).toHaveLength(17);
    expect(
      fresh.state.round.trumps!.hands.human.every(
        (c) => !firstIDs.has(c.instanceId),
      ),
    ).toBe(true);
    expect(
      fresh.state.round.trumps!.hands.human.every(
        (c) => c.origin.type === "stock" && c.origin.game === 2,
      ),
    ).toBe(true);
  });
  it("finishes a real resource BO5, clears the final Game, and starts a fresh isolated Match", () => {
    const sources = streams();
    let state = createMatch(sources, rules({ filler: 20 })).state;
    const previousIDs = new Set<string>();
    for (let i = 0; i < 15; i++) {
      const ids = [
        ...state.round.deck,
        ...state.round.hands.human,
        ...state.round.hands.ai,
      ].map((c) => c.instanceId);
      expect(ids.every((id) => !previousIDs.has(id))).toBe(true);
      ids.forEach((id) => previousIDs.add(id));
      state = finish(state, sources);
      if (state.phase === "complete") break;
      state = send(state, sources, "NextRound").state;
    }
    expect(state.phase).toBe("complete");
    expect(state.wins).toEqual({ human: 3, ai: 0 });
    expect(state.round.trumps).toMatchObject({
      hands: { human: [], ai: [] },
      stock: { human: [], ai: [] },
      table: [],
      destroyed: [],
    });
    const counts = [
      sources.numbers.mock.calls.length,
      sources.trumpSelection.mock.calls.length,
    ];
    expect(send(state, sources, "NextRound").state).toBe(state);
    expect([
      sources.numbers.mock.calls.length,
      sources.trumpSelection.mock.calls.length,
    ]).toEqual(counts);
    const fresh = createMatch(streams(), rules({ filler: 20 })).state;
    expect(fresh.round.trumps!.hands.human).toHaveLength(3);
    expect(fresh.round.trumps!.stock.human).toHaveLength(17);
    expect(state.round.trumps!.hands.human).toEqual([]);
  });
  it.each(["easy", "standard", "challenge", "danger", "nightmare"] as const)(
    "%s gates at the exact configured probability without changing the number result",
    (difficulty) => {
      const p = HIT_PROBABILITIES[difficulty];
      const miss = streams([], p),
        success = streams([], p - Number.EPSILON);
      const a = createMatch(miss, rules({ filler: 20 }, difficulty)).state;
      const b = createMatch(success, rules({ filler: 20 }, difficulty)).state;
      const x = send(a, miss, "Hit"),
        y = send(b, success, "Hit");
      frames(x, 40);
      frames(y, 40);
      expect(x.state.round.hands).toEqual(y.state.round.hands);
      expect(miss.trumpGate).toHaveBeenCalledTimes(1);
      expect(success.trumpGate).toHaveBeenCalledTimes(1);
      expect(miss.trumpSelection).toHaveBeenCalledTimes(6);
      expect(success.trumpSelection).toHaveBeenCalledTimes(7);
      expect(x.state.round.trumps!.hands.human).toHaveLength(3);
      expect(y.state.round.trumps!.hands.human).toHaveLength(4);
      expect(x.state.round.turn!.number).toBe(2);
      expect(y.state.round.lastPlay).toMatchObject({
        type: "number",
        player: "human",
      });
    },
  );
  it("rolls only once for a two-number ordinary Hit and hands over only after its last number", () => {
    const sources = streams();
    const initial = createMatch(sources, rules({ filler: 20 })).state;
    const modified = freezeData({
      ...initial,
      round: {
        ...initial.round,
        hitDrawCounts: { human: 2 as const, ai: 1 as const },
      },
    });
    const result = send(modified, sources, "Hit");
    frames(result, 40);
    const hits = result.events.flatMap((e) =>
      e.type === "round" && e.event.type === "hit" ? [e.event] : [],
    );
    expect(hits).toHaveLength(2);
    expect(hits[0].state.turn!.player).toBe("human");
    expect(hits[1].state.turn).toEqual({
      player: "ai",
      number: 2,
      usedTrump: false,
    });
    expect(result.state.round.hands.human).toHaveLength(4);
    expect(sources.trumpGate).toHaveBeenCalledTimes(1);
    expect(sources.trumpSelection).toHaveBeenCalledTimes(7);
    expect(result.state.round.lastPlay).toEqual({
      type: "number",
      player: "human",
      instanceId: result.state.round.hands.human.at(-1)!.instanceId,
    });
  });
  it("changes neither current nor next-round number order when resource streams differ", () => {
    const a = streams([], 0),
      b = streams(Array(30).fill(0.99), 0.99),
      r = rules({ filler: 20, target: 1 });
    let x = createMatch(a, r).state,
      y = createMatch(b, r).state;
    for (let i = 0; i < 3; i++) {
      x = send(x, a, "Hit").state;
      y = send(y, b, "Hit").state;
      expect(x.round.hands).toEqual(y.round.hands);
      expect(x.round.deck).toEqual(y.round.deck);
    }
    x = send(finish(x, a), a, "NextRound").state;
    y = send(finish(y, b), b, "NextRound").state;
    expect(x.round.hands).toEqual(y.round.hands);
    expect(x.round.deck).toEqual(y.round.deck);
    expect(a.numbers).toHaveBeenCalledTimes(21);
    expect(b.numbers).toHaveBeenCalledTimes(21);
    expect(a.trumpSelection.mock.calls.length).not.toBe(
      b.trumpSelection.mock.calls.length,
    );
  });
  it("does not roll the Hit gate for specific/forced/multi-card effect draws or returns", () => {
    for (const id of ["drawer", "top", "forced", "returner"]) {
      const sources = streams();
      const state = createMatch(sources, rules({ [id]: 1, filler: 20 })).state;
      const drawn = play(state, sources, id);
      frames(drawn, 42);
      expect(sources.trumpGate).not.toHaveBeenCalled();
      expect(sources.trumpSelection).toHaveBeenCalledTimes(6);
      expect(sources.numbers).toHaveBeenCalledTimes(11);
      expect(drawn.state.round.turn!.player).toBe("human");
      expect(drawn.state.round.trumps!.destroyed[0].reason).toBe("played");
      expect(drawn.state.round.lastPlay).toMatchObject({
        type: "trump",
        deltas: expect.any(Array),
      });
    }
  });
  it("caps a partial multi-grant at eight; a full-hand Hit still rolls once but never selects", () => {
    const sources = streams();
    let state = createMatch(sources, rules({ fill: 1, filler: 30 })).state;
    const result = play(state, sources, "fill");
    frames(result, 62);
    state = result.state;
    expect(state.round.trumps!.hands.human).toHaveLength(8);
    const attempts = roundResources(result);
    expect(attempts.filter((e) => e.instance)).toHaveLength(6);
    expect(attempts.at(-1)!.instance).toBeNull();
    const selectCount = sources.trumpSelection.mock.calls.length;
    const stock = state.round.trumps!.stock.human;
    const hit = send(state, sources, "Hit");
    frames(hit, 62);
    expect(sources.trumpGate).toHaveBeenCalledTimes(1);
    expect(sources.trumpSelection).toHaveBeenCalledTimes(selectCount);
    expect(hit.state.round.trumps!.stock.human).toBe(stock);
    expect(hit.state.round.trumps!.hands.human).toHaveLength(8);
    state = send(hit.state, sources, "Stay").state;
    const used = play(state, sources, "filler");
    expect(used.state.round.trumps!.hands.human).toHaveLength(7);
  });
  it("naturally grants zero with no stock while ordinary Hit and Stay continue", () => {
    const sources = streams();
    const initial = createMatch(sources, rules({ filler: 1 }));
    frames(initial, 2);
    expect(sources.trumpSelection).toHaveBeenCalledTimes(2);
    expect(initial.state.round.trumps!.hands.human).toHaveLength(1);
    const result = send(initial.state, sources, "Hit");
    frames(result, 2);
    expect(sources.trumpGate).toHaveBeenCalledTimes(1);
    expect(sources.trumpSelection).toHaveBeenCalledTimes(2);
    expect(result.state.round.deck).toHaveLength(6);
    expect(send(result.state, sources, "Stay").state.round.turn!.player).toBe(
      "human",
    );
  });
  it("rejects stale/non-actor/missing/cost-invalid/full-table commands with zero randomness", () => {
    const sources = streams();
    let state = createMatch(
      sources,
      rules({ fill: 1, mixed: 1, filler: 30 }),
    ).state;
    state = play(state, sources, "fill").state;
    for (let i = 0; i < 5; i++) state = play(state, sources, "filler").state;
    const mixed = state.round.trumps!.hands.human.find(
      (c) => c.definitionId === "mixed",
    )!;
    const before = [
      sources.numbers.mock.calls.length,
      sources.trumpGate.mock.calls.length,
      sources.trumpSelection.mock.calls.length,
    ];
    for (const command of [
      { type: "Hit", player: "ai", roundNumber: state.roundNumber },
      { type: "Hit", player: "human", roundNumber: 0 },
      {
        type: "PlayTrump",
        player: "human",
        instanceId: "missing",
        roundNumber: state.roundNumber,
      },
      {
        type: "PlayTrump",
        player: "human",
        instanceId: mixed.instanceId,
        roundNumber: state.roundNumber,
      },
    ] as const) {
      const result = transitionMatch(state, command, sources);
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    }
    expect([
      sources.numbers.mock.calls.length,
      sources.trumpGate.mock.calls.length,
      sources.trumpSelection.mock.calls.length,
    ]).toEqual(before);
  });
});

describe("draw, generate, delete and transfer retain distinct origins", () => {
  it("selects a remaining instance uniformly and never selects a spent stock copy twice", () => {
    const r = rules({ target: 1, filler: 2 }).trumps!;
    const original = createTrumpState(r);
    for (const [sample, id] of [
      [0, "target"],
      [0.4, "filler"],
      [0.99, "filler"],
    ] as const)
      expect(
        drawTrump(original, "human", () => sample).instance!.definitionId,
      ).toBe(id);
    const random = vi.fn(() => 0.2);
    const first = drawTrump(original, "human", random, "target");
    expect(first.instance!.definitionId).toBe("target");
    expect(random).not.toHaveBeenCalled();
    const second = drawTrump(first.state, "human", random, "target");
    expect(second.state).toBe(first.state);
    expect(second.instance).toBeNull();
    expect(random).not.toHaveBeenCalled();
    expect(first.state.stock.ai).toBe(original.stock.ai);
    trumpLedger(first.state, 6);
  });
  it("permits one own-stock copy plus transferred/generated copies without taking another stock copy", () => {
    const r = rules({ target: 1, filler: 2 }).trumps!;
    let state = createTrumpState(r);
    state = drawTrump(state, "human", undefined, "target").state;
    const other = drawTrump(state, "ai", undefined, "target");
    state = transferTrump(
      other.state,
      "ai",
      "human",
      other.instance!.instanceId,
    );
    const origins = state.hands.human.map((c) => c.origin);
    expect(origins).toContainEqual({ type: "stock", owner: "human", game: 1 });
    expect(origins).toContainEqual({ type: "stock", owner: "ai", game: 1 });
    const generated = generateTrump(state, "human", "target", "ability", r);
    expect(generated.state.hands.human).toHaveLength(3);
    expect(generated.instance!.origin).toEqual({
      type: "generated",
      sourceId: "ability",
    });
    expect(generated.state.stock).toBe(state.stock);
    expect(
      drawTrump(generated.state, "human", undefined, "target").instance,
    ).toBeNull();
    state = deleteTrump(
      generated.state,
      "human",
      generated.instance!.instanceId,
    );
    expect(state.stock).toEqual(generated.state.stock);
    expect(state.destroyed.at(-1)!.instance).toBe(generated.instance);
    const again = generateTrump(state, "human", "target", "ability", r);
    expect(again.instance!.instanceId).not.toBe(generated.instance!.instanceId);
    trumpLedger(again.state, 6);
  });
  it("deletes only the declared remaining stock copy, never a held card or the other side", () => {
    const r = rules({ target: 1, filler: 2 }).trumps!;
    let state = createTrumpState(r);
    const original = state;
    const removed = deleteStockTrump(state, "ai", "target", true);
    state = removed.state;
    expect(state.stock.human).toBe(original.stock.human);
    expect(state.hands).toEqual(original.hands);
    expect(state.stock.ai).toHaveLength(2);
    expect(state.destroyed.at(-1)!.instance).toBe(removed.instance);
    expect(deleteStockTrump(state, "ai", "target").state).toBe(state);
    expect(drawTrump(state, "ai", undefined, "target").instance).toBeNull();
    trumpLedger(state, 6);
  });
  it("keeps deleted seeds dead and never collides with an injected generated-looking ID", () => {
    const r = { tableCapacity: 5 as const, definitions };
    let state = createTrumpState(r, {
      human: [{ instanceId: "game-1:generated-1", definitionId: "target" }],
      ai: [],
    });
    state = deleteTrump(state, "human", "game-1:generated-1");
    const result = generateTrump(state, "human", "target", "skill", r);
    expect(result.instance!.instanceId).not.toBe("game-1:generated-1");
    expect(result.state.destroyed).toHaveLength(1);
  });
  it("does not generate or transfer into a full hand, and counts no nonexistent generated card", () => {
    const r = { tableCapacity: 5 as const, definitions };
    let state = createTrumpState(r, {
      human: Array.from({ length: 8 }, (_, i) => ({
        instanceId: "h" + i,
        definitionId: "filler",
      })),
      ai: [{ instanceId: "a", definitionId: "target" }],
    });
    expect(generateTrump(state, "human", "target", "skill", r)).toEqual({
      state,
      instance: null,
    });
    expect(transferTrump(state, "ai", "human", "a")).toBe(state);
    expect(state.nextGeneratedId).toBe(1);
    state = deleteTrump(state, "human", "h0");
    const moved = transferTrump(state, "ai", "human", "a");
    expect(moved.hands.human.at(-1)!.instanceId).toBe("a");
    expect(moved.hands.human.at(-1)!.origin).toEqual({
      type: "fixture",
      owner: "ai",
      game: 1,
    });
  });
  it("generates duplicate numeric values with new IDs; delete does not return or replace a number", () => {
    const sources = streams();
    const start = createMatch(
      sources,
      rules({ clone: 1, eraser: 1, filler: 20 }),
    ).state;
    const generated = play(start, sources, "clone");
    frames(generated, 44);
    const a = generated.state.round;
    expect(a.hands.human.at(-1)!.value).toBe(1);
    expect(
      [...a.deck, ...a.hands.human, ...a.hands.ai].filter((c) => c.value === 1),
    ).toHaveLength(2);
    expect(a.lastPlay).toMatchObject({
      type: "trump",
      deltas: [{ type: "number-generated" }],
    });
    const deleted = play(generated.state, sources, "eraser");
    frames(deleted, 44);
    expect(deleted.state.round.deck).toBe(a.deck);
    expect(deleted.state.round.deletedNumbers).toHaveLength(1);
    expect(deleted.state.round.lastPlay).toMatchObject({
      type: "trump",
      deltas: [{ type: "number-deleted" }],
    });
    const b = generateNumber(deleted.state.round, "ai", 1, "skill");
    expect(b.hands.ai.at(-1)!.instanceId).not.toBe(
      a.hands.human.at(-1)!.instanceId,
    );
    numberLedger(b);
    expect(deleteNumber(b, "ai", b.hiddenCards.ai!)).toBe(b);
    expect(transferNumber(b, "ai", "human", b.hiddenCards.ai!)).toBe(b);
    const moved = transferNumber(
      b,
      "ai",
      "human",
      b.hands.ai.at(-1)!.instanceId,
    );
    expect(moved.hands.human.at(-1)).toBe(b.hands.ai.at(-1));
    numberLedger(moved);
    const top = moved.deck[0];
    const cut = deleteNumber(moved, null, top.instanceId);
    expect(cut.deck).toEqual(moved.deck.slice(1));
    expect(cut.hands).toBe(moved.hands);
    expect(cut.deletedNumbers.at(-1)).toBe(top);
    numberLedger(cut);
  });
});

describe("privacy and frozen policy boundaries", () => {
  it("projects every grant/generation only to its recipient, never exposing private inventory or counters", () => {
    const sources = streams();
    const created = createMatch(sources, rules({ creator: 1, filler: 20 }));
    const result = play(created.state, sources, "creator");
    for (const transition of [created, result]) {
      for (const viewer of ["human", "ai"] as const) {
        const projected = projectMatchTransition(transition, viewer);
        for (const event of projected.events) {
          const own = event.state.round.trumps!;
          expect(own).not.toHaveProperty("stock");
          expect(own).not.toHaveProperty("nextGeneratedId");
          expect(own).not.toHaveProperty("nextEffectId");
          expect(event.state.round).not.toHaveProperty("deletedNumbers");
          if (
            event.type === "round" &&
            event.event.type === "resource" &&
            event.event.player !== viewer
          )
            expect(event.event.instance).toBeNull();
          const other: PlayerId = viewer === "human" ? "ai" : "human";
          for (const card of transition.state.round.trumps!.stock[other])
            expect(JSON.stringify(event)).not.toContain(card.instanceId);
        }
      }
    }
    expect(result.state.round.trumps!.hands.human.at(-1)!.origin.type).toBe(
      "generated",
    );
    expect(result.state.round.trumps!.stock.human).toBe(
      created.state.round.trumps!.stock.human,
    );
  });
  it("keeps hidden fee identities out of opposing audit, event payload and per-event snapshots", () => {
    function variant(definitionId: string) {
      const shuffle = fixedRandom([10, 8, 11, 9]);
      let coin = true;
      const random = () => (coin ? ((coin = false), 0.25) : shuffle());
      let state = createMatch(
        random,
        {
          version: 1,
          pointTarget: 21,
          trumps: { tableCapacity: 5, definitions },
        },
        {
          human: [],
          ai: [
            { instanceId: "played", definitionId: "cost" },
            { instanceId: "fee", definitionId },
            { instanceId: "remaining", definitionId: "filler" },
          ],
        },
      ).state;
      state = transitionMatch(
        state,
        { type: "Stay", player: "human", roundNumber: 1 },
        () => {
          throw new Error("No random");
        },
      ).state;
      const result = transitionMatch(
        state,
        {
          type: "PlayTrump",
          player: "ai",
          instanceId: "played",
          costIds: ["fee"],
          roundNumber: 1,
        },
        () => {
          throw new Error("No random");
        },
      );
      return { state, result };
    }
    const a = variant("drawer"),
      b = variant("returner");
    expect(observeMatch(a.state, "human")).toEqual(
      observeMatch(b.state, "human"),
    );
    expect(projectMatchTransition(a.result, "human")).toEqual(
      projectMatchTransition(b.result, "human"),
    );
    expect(
      observeMatch(a.result.state, "human").round.trumps!.destroyed.find(
        (d) => d.reason === "cost",
      )!.instance,
    ).toBeNull();
    expect(
      observeMatch(a.result.state, "ai").round.trumps!.destroyed.find(
        (d) => d.reason === "cost",
      )!.instance!.definitionId,
    ).toBe("drawer");
    expect(a.result.state.round.turn!.player).toBe("ai");
    expect(a.result.state.round.trumps!.hands.ai).toHaveLength(1);
  });
  it("does not use hidden targeted availability to change legal commands or consume the failed card twice", () => {
    const a = streams([0, 0, 0, 0, 0, 0.99]),
      b = streams([0, 0, 0, 0.99, 0, 0.99]);
    const r = rules({ searcher: 1, target: 1, filler: 10 });
    const x = createMatch(a, r).state,
      y = createMatch(b, r).state;
    expect(observeMatch(x, "human")).toEqual(observeMatch(y, "human"));
    expect(legalTrumpCommands(observeMatch(x, "human").round)).toEqual(
      legalTrumpCommands(observeMatch(y, "human").round),
    );
    const failed = play(x, a, "searcher"),
      success = play(y, b, "searcher");
    expect(roundResources(failed)[0].instance).toBeNull();
    expect(roundResources(success)[0].instance!.definitionId).toBe("target");
    const spent = failed.state.round.trumps!.destroyed[0].instance.instanceId;
    expect(
      transitionMatch(
        failed.state,
        {
          type: "PlayTrump",
          player: "human",
          instanceId: spent,
          roundNumber: 1,
        },
        a,
      ).state,
    ).toBe(failed.state);
    expect(failed.state.round.turn!.usedTrump).toBe(true);
  });
  it("copies mutable policy once; later caller edits never change stock or frozen round identity", () => {
    const stock = { filler: 20 };
    const input = rules(stock),
      sources = streams();
    let state = createMatch(sources, input).state;
    const snapshot = state.rules.round;
    stock.filler = 0;
    expect(Object.isFrozen(stock)).toBe(false);
    expect(state.rules.round.trumps!.resources!.stock.filler).toBe(20);
    expect(Object.isFrozen(snapshot.trumps!.resources!.stock)).toBe(true);
    state = finish(state, sources);
    state = send(state, sources, "NextRound").state;
    expect(state.round.rules).toBe(snapshot);
    expect(state.round.trumps!.stock.human).toHaveLength(16);
    expect(cleanupRound(cleanupRound(state.round))).toEqual(
      cleanupRound(state.round),
    );
  });
  it.each([
    ["unknown stock definition", { stock: { unknown: 1 } }],
    ["negative count", { stock: { filler: -1 } }],
    ["fractional count", { stock: { filler: 0.5 } }],
    ["wrong capacity", { handLimit: 9 }],
    ["wrong probability", { hitProbability: 0.99 }],
    ["wrong initial grant", { gameGrant: 3 }],
  ])("rejects %s before any random call", (_name, change) => {
    const r = rules({ filler: 10 });
    const invalid = {
      ...r,
      trumps: {
        ...r.trumps!,
        resources: { ...r.trumps!.resources!, ...change },
      },
    } as RoundRules;
    const s = streams();
    expect(() => createMatch(s, invalid)).toThrow(RangeError);
    expect(s.numbers).not.toHaveBeenCalled();
    expect(s.trumpSelection).not.toHaveBeenCalled();
    expect(s.trumpGate).not.toHaveBeenCalled();
  });
  it("rejects duplicate, missing, self or extraneous private costs before consumption", () => {
    const s = streams();
    const state = createMatch(s, rules({ cost: 1, filler: 20 })).state;
    const body = state.round.trumps!.hands.human.find(
      (c) => c.definitionId === "cost",
    )!;
    const fee = state.round.trumps!.hands.human.find(
      (c) => c.definitionId === "filler",
    )!;
    const before = s.trumpSelection.mock.calls.length;
    for (const costIds of [
      [],
      [fee.instanceId, fee.instanceId],
      ["missing"],
      [body.instanceId],
    ]) {
      const result = transitionMatch(
        state,
        {
          type: "PlayTrump",
          player: "human",
          instanceId: body.instanceId,
          costIds,
          roundNumber: 1,
        },
        s,
      );
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    }
    expect(s.numbers).toHaveBeenCalledTimes(11);
    expect(s.trumpGate).not.toHaveBeenCalled();
    expect(s.trumpSelection).toHaveBeenCalledTimes(before);
  });
  it("rejects missing separate streams, unsupported effects and stock-plus-fixture initialization without randomness", () => {
    const s = streams(),
      r = rules({ filler: 10 });
    expect(() => createMatch(s.numbers, r)).toThrow(RangeError);
    expect(() =>
      createMatch(s, {
        ...r,
        trumps: {
          ...r.trumps!,
          definitions: {
            ...definitions,
            bad: { onPlay: [{ type: "unimplemented" } as never] },
          },
        },
      }),
    ).toThrow(RangeError);
    expect(() => createMatch(s, r, { human: [], ai: [] })).toThrow(RangeError);
    expect(s.numbers).not.toHaveBeenCalled();
    expect(s.trumpSelection).not.toHaveBeenCalled();
    expect(s.trumpGate).not.toHaveBeenCalled();
  });
});
