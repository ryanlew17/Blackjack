// @req REQ-2026-019: all outcomes use real transitions, not patched states.
import { describe, expect, it, vi } from "vitest";
import {
  createMatch,
  observeMatch,
  transitionMatch,
  legalMatchActions,
  projectMatchTransition,
  legalTrumpCommands,
} from "./index";
import type {
  MatchState,
  MatchTransition,
  RandomSource,
  TrumpSetup,
} from "./index";
import type { NumberValue, PlayerId } from "../types";
import { PROTOTYPE_RULES, prototypeSetup } from "./prototype";
import { fixedRandom } from "./testHelpers";
import { cleanupRound, cleanupGame } from "./lifecycle";
import { observeTrumps } from "./effects";

const noRandom = () => {
  throw new Error("Commands cannot consume deal randomness");
};
function fixture(
  human: readonly string[],
  ai: readonly string[] = [],
  prefix: readonly NumberValue[] = [10, 8, 11, 9],
) {
  const shuffle = fixedRandom(prefix);
  let coin = true;
  const random = () => {
    if (coin) {
      coin = false;
      return 0.25;
    }
    return shuffle();
  };
  const setup = prototypeSetup(human, ai);
  return { state: createMatch(random, PROTOTYPE_RULES, setup).state, setup };
}
function play(
  state: MatchState,
  instanceId: string,
  targetId?: string,
  player: PlayerId = state.round.turn!.player,
) {
  return transitionMatch(
    state,
    {
      type: "PlayTrump",
      player,
      instanceId,
      ...(targetId ? { targetId } : {}),
      roundNumber: state.roundNumber,
    },
    noRandom,
  );
}
const stay = (state: MatchState) =>
  transitionMatch(
    state,
    {
      type: "Stay",
      player: state.round.turn!.player,
      roundNumber: state.roundNumber,
    },
    noRandom,
  );
const hit = (state: MatchState) =>
  transitionMatch(
    state,
    {
      type: "Hit",
      player: state.round.turn!.player,
      roundNumber: state.roundNumber,
    },
    noRandom,
  );
function finish(state: MatchState) {
  while (state.phase === "playing") state = stay(state).state;
  return state;
}
function conserve(result: MatchTransition, setup: TrumpSetup) {
  for (const state of [result.state, ...result.events.map((e) => e.state)]) {
    expect(
      [
        ...state.round.deck,
        ...state.round.hands.human,
        ...state.round.hands.ai,
      ].sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
    const t = state.round.trumps!;
    const ids = [...t.hands.human, ...t.hands.ai, ...t.table, ...t.discarded]
      .map((t) => t.instanceId)
      .sort();
    expect(ids).toEqual(
      [...setup.human, ...setup.ai].map((t) => t.instanceId).sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.isFrozen(state)).toBe(true);
  }
}
function assertProjected(value: unknown) {
  if (value && typeof value === "object") {
    expect(Object.keys(value)).not.toContain("deck");
    expect(Object.keys(value)).not.toContain("trumpSetup");
    for (const child of Object.values(value)) assertProjected(child);
  }
}

describe("atomic multi-trump turns", () => {
  it("draws, rescues a bust and uses a mixed effect without handing over the turn", () => {
    let { state, setup } = fixture([
      "test-draw-2",
      "test-return",
      "test-mixed",
      "test-return",
    ]);
    for (const [index, total, target] of [
      [0, 23, 21],
      [1, 21, 21],
      [2, 24, 24],
    ]) {
      const result = play(state, `human-${index}`);
      conserve(result, setup);
      state = result.state;
      expect(observeMatch(state, "human").round.hands.human.total).toBe(total);
      expect(state.round.pointTarget).toBe(target);
      expect(state.round.turn).toEqual({
        player: "human",
        number: 1,
        usedTrump: true,
      });
      expect(state.round.quietStays).toBe(0);
      expect(state.game.points).toEqual({ human: 0, ai: 0 });
    }
    const first = stay(state);
    state = first.state;
    expect(state.round.turn).toEqual({
      player: "ai",
      number: 2,
      usedTrump: false,
    });
    expect(state.round.quietStays).toBe(0);
    state = stay(state).state;
    expect(state.phase).toBe("playing"); // both have stayed, but the trump user's stay was not quiet.
    expect(state.round.quietStays).toBe(1);
    const result = stay(state);
    conserve(result, setup);
    expect(result.state.game.points).toEqual({ human: 1, ai: 0 });
    expect(result.state.round.result).toMatchObject({
      winner: "human",
      pointTarget: 24,
    });
    expect(result.state.round.pointTarget).toBe(21);
    expect(result.state.round.trumps!.table).toEqual([]);
    expect(result.state.round.trumps!.hands.human).toHaveLength(1);
    expect(result.events.filter((e) => e.type === "round-scored")).toHaveLength(
      1,
    );
    expect(
      result.events.filter((e) => e.type === "round").map((e) => e.event.type),
    ).toEqual(["stay", "reveal", "reveal", "settled"]);
  });
  it("Hit hands over only once after multiple trumps, resetting quiet history", () => {
    let { state } = fixture(["test-marker", "test-marker"]);
    state = play(state, "human-0").state;
    state = play(state, "human-1").state;
    state = hit(state).state;
    expect(state.round.turn).toEqual({
      player: "ai",
      number: 2,
      usedTrump: false,
    });
    expect(state.round.quietStays).toBe(0);
  });
  it("a trump invalidates an earlier opponent Stay, even when its draw fails", () => {
    let { state } = fixture([], ["test-draw-2"], [2, 8, 11, 9]);
    state = stay(state).state;
    expect(state.round.quietStays).toBe(1);
    state = play(state, "ai-0").state;
    expect(state.round.quietStays).toBe(0);
    expect(state.round.turn?.player).toBe("ai");
    state = stay(state).state;
    state = stay(state).state;
    expect(state.phase).toBe("playing");
    expect(stay(state).state.phase).toBe("round-complete");
  });
  it("only returns the last face-up card and cannot consume against the hidden card", () => {
    let { state, setup } = fixture(["test-return", "test-return"]);
    const returned = play(state, "human-0");
    conserve(returned, setup);
    state = returned.state;
    expect(state.round.hands.human).toEqual([10]);
    expect(state.round.deck.at(-1)).toBe(11);
    expect(legalTrumpCommands(observeMatch(state, "human").round)).toEqual([]);
    const illegal = play(state, "human-1");
    expect(illegal.state).toBe(state);
    expect(illegal.events).toEqual([]);
    expect(state.round.trumps!.hands.human.map((t) => t.instanceId)).toEqual([
      "human-1",
    ]);
  });
  it("rejects non-actors, unknown instances, stale rounds and extraneous targets atomically", () => {
    const { state } = fixture(["test-draw-2"], ["test-marker"]);
    const results = [
      play(state, "ai-0", undefined, "ai"),
      play(state, "missing"),
      play(state, "human-0", "missing"),
      transitionMatch(
        state,
        {
          type: "PlayTrump",
          player: "human",
          instanceId: "human-0",
          roundNumber: 0,
        },
        noRandom,
      ),
    ];
    for (const result of results) {
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    }
    const consumed = play(state, "human-0").state;
    expect(play(consumed, "human-0").state).toBe(consumed);
  });
});

describe("public legality and event projection", () => {
  it("identical observations have identical legal actions despite hidden draw availability", () => {
    const a = fixture(["test-draw-2"], [], [10, 2, 11, 8]).state;
    const b = fixture(["test-draw-2"], [], [10, 3, 11, 8]).state;
    expect(observeMatch(a, "human")).toEqual(observeMatch(b, "human"));
    expect(legalMatchActions(observeMatch(a, "human"))).toEqual(
      legalMatchActions(observeMatch(b, "human")),
    );
    expect(legalTrumpCommands(observeMatch(a, "human").round)).toEqual(
      legalTrumpCommands(observeMatch(b, "human").round),
    );
    const failed = play(a, "human-0"),
      success = play(b, "human-0");
    expect(failed.state.round.hands.human).toEqual([10, 11]);
    expect(failed.state.round.turn?.usedTrump).toBe(true);
    expect(failed.state.round.trumps!.hands.human).toEqual([]);
    expect(
      failed.events.filter((e) => e.type === "round").at(-1),
    ).toMatchObject({ event: { type: "trump", effect: "draw", card: null } });
    expect(success.state.round.hands.human).toEqual([10, 11, 2]);
    for (const result of [failed, success])
      for (const viewer of ["human", "ai"] as const) {
        const projected = projectMatchTransition(result, viewer);
        assertProjected(projected);
        for (const event of projected.events)
          expect(
            event.state.round.hands[viewer === "human" ? "ai" : "human"]
              .cards[0].value,
          ).toBeNull();
      }
  });
  it("keeps unplayed opposing instance identities out of all snapshots, payloads and rules", () => {
    const { state } = fixture(["test-marker"], ["test-dispel", "test-mixed"]);
    const result = projectMatchTransition(play(state, "human-0"), "human");
    expect(JSON.stringify(result)).not.toContain('"ai-0"');
    expect(JSON.stringify(result)).not.toContain('"ai-1"');
    expect(result.state.round.trumps?.opponentHandCount).toBe(2);
    assertProjected(result);
    expect(observeMatch(state, "ai").round.trumps?.ownHand).toHaveLength(2);
  });
  it("still permits a legal failed draw from an empty deck, without reshuffling", () => {
    let { state } = fixture(["test-draw-2"]);
    while (state.round.deck.length) {
      state = hit(state).state;
      state = stay(state).state;
    }
    expect(state.round.turn?.player).toBe("human");
    expect(legalMatchActions(observeMatch(state, "human"))).toEqual([
      "Stay",
      "PlayTrump",
    ]);
    const result = play(state, "human-0");
    expect(result.state.round.deck).toEqual([]);
    expect(result.state.round.hands).toEqual(state.round.hands);
    expect(result.state.round.turn?.usedTrump).toBe(true);
  });
});

describe("table capacity, replacement and cleanup", () => {
  it("rejects a full-table mixed effect before draw/consumption but allows pure immediate effects", () => {
    let { state, setup } = fixture([
      ...Array(5).fill("test-marker"),
      "test-mixed",
      "test-draw-2",
    ]);
    for (let i = 0; i < 5; i++) {
      const result = play(state, `human-${i}`);
      conserve(result, setup);
      state = result.state;
    }
    const rejected = play(state, "human-5");
    expect(rejected.state).toBe(state);
    expect(rejected.events).toEqual([]);
    expect(state.round.hands.human).toEqual([10, 11]);
    expect(state.round.deck).toContain(3);
    const immediate = play(state, "human-6");
    conserve(immediate, setup);
    expect(immediate.state.round.hands.human).toEqual([10, 11, 2]);
    expect(immediate.state.round.trumps!.table).toHaveLength(5);
  });
  it("replaces the global target across players, then clearing restores 21 without resurrecting old effects", () => {
    let { state, setup } = fixture(
      ["test-target-17", "test-dispel"],
      ["test-mixed"],
    );
    state = play(state, "human-0").state;
    expect(state.round.pointTarget).toBe(17);
    state = stay(state).state;
    const mixed = play(state, "ai-0");
    conserve(mixed, setup);
    state = mixed.state;
    expect(state.round.pointTarget).toBe(24);
    expect(state.round.trumps!.table.map((t) => t.instanceId)).toEqual([
      "ai-0",
    ]);
    expect(state.round.trumps!.discarded.map((t) => t.instanceId)).toContain(
      "human-0",
    );
    const drawn = state.round.hands.ai;
    state = stay(state).state;
    const cleared = play(state, "human-1", "ai-0");
    conserve(cleared, setup);
    state = cleared.state;
    expect(state.round.pointTarget).toBe(21);
    expect(state.round.trumps!.table).toEqual([]);
    expect(state.round.hands.ai).toEqual(drawn); // completed draw is not rolled back.
    expect(state.round.turn?.player).toBe("human");
  });
  it("allows own target replacement at five occupied slots, retaining exactly five", () => {
    let { state } = fixture([
      "test-target-17",
      ...Array(4).fill("test-marker"),
      "test-target-24",
    ]);
    for (let i = 0; i < 5; i++) state = play(state, `human-${i}`).state;
    state = play(state, "human-5").state;
    expect(state.round.trumps!.table).toHaveLength(5);
    expect(state.round.pointTarget).toBe(24);
  });
  it("rejects clearing missing/own targets without consuming the remover", () => {
    let { state } = fixture(["test-marker", "test-dispel"]);
    state = play(state, "human-0").state;
    for (const target of [undefined, "missing", "human-0"]) {
      const r = play(state, "human-1", target);
      expect(r.state).toBe(state);
      expect(r.events).toEqual([]);
    }
  });
  it("retains hands across rounds, clears all resources at Game end and resets the explicit setup for the next Game", () => {
    const samples = [0.25];
    for (let i = 0; i < 6; i++) {
      const random = fixedRandom(i % 2 === 0 ? [10, 8, 11, 9] : [8, 10, 9, 11]);
      for (let j = 0; j < 10; j++) samples.push(random());
    }
    let index = 0;
    const random: RandomSource = () => samples[index++];
    const setup = prototypeSetup(["test-mixed", "test-draw-2"]);
    let state = createMatch(random, PROTOTYPE_RULES, setup).state;
    const rules = state.rules.round;
    state = finish(play(state, "human-0").state);
    expect(state.round.trumps!.hands.human.map((t) => t.instanceId)).toEqual([
      "human-1",
    ]);
    expect(cleanupRound(cleanupRound(state.round))).toEqual(
      cleanupRound(state.round),
    );
    for (let round = 1; round < 5; round++) {
      state = transitionMatch(
        state,
        { type: "NextRound", roundNumber: state.roundNumber },
        random,
      ).state;
      expect(state.rules.round).toBe(rules);
      expect(state.round.trumps!.hands.human).toHaveLength(1);
      state = finish(state);
    }
    expect(state.phase).toBe("game-complete");
    expect(state.game.points.human).toBe(5);
    expect(state.round.trumps).toEqual({
      hands: { human: [], ai: [] },
      table: [],
      discarded: [],
    });
    expect(cleanupGame(cleanupGame(state.round))).toEqual(
      cleanupGame(state.round),
    );
    state = transitionMatch(
      state,
      { type: "NextRound", roundNumber: state.roundNumber },
      random,
    ).state;
    expect(state.game.number).toBe(2);
    expect(state.game.points).toEqual({ human: 0, ai: 0 });
    expect(state.round.trumps!.hands).toEqual(setup);
    expect(state.round.pointTarget).toBe(21);
    expect(state.rules.round).toBe(rules);
  });
  it("keeps the default path no-trump and rejects prototype commands without explicit injection", () => {
    let coin = true;
    const shuffle = fixedRandom([10, 8, 11, 9]);
    const state = createMatch(() => {
      if (coin) {
        coin = false;
        return 0.25;
      }
      return shuffle();
    }).state;
    expect(state.rules.trumpDealing).toBe(false);
    expect(state.round.trumps).toBeUndefined();
    expect(state.rules.round.trumps).toBeUndefined();
    expect(observeMatch(state, "human").round.trumps).toBeUndefined();
    expect(play(state, "human-0").state).toBe(state);
  });
});

it("copies mutable nested rules and private setup while reusing one frozen snapshot across rounds", () => {
  const effect = { type: "draw-number" as const, value: 2 as NumberValue };
  const rules = Object.freeze({
    version: 1 as const,
    pointTarget: 21,
    trumps: Object.freeze({
      tableCapacity: 5 as const,
      definitions: Object.freeze({ mutable: { onPlay: [effect] } }),
    }),
  });
  const setup = {
    human: [{ instanceId: "held", definitionId: "mutable" }],
    ai: [],
  };
  const shuffle = fixedRandom([10, 8, 11, 9]);
  let n = 0;
  const random = () => (n++ === 0 ? 0.25 : n <= 11 ? shuffle() : 0.5);
  let state = createMatch(random, rules, setup).state;
  const snapshot = state.rules.round;
  effect.value = 7;
  setup.human[0].instanceId = "changed";
  expect(snapshot).not.toBe(rules);
  expect(Object.isFrozen(snapshot.trumps!.definitions.mutable.onPlay[0])).toBe(
    true,
  );
  state = play(state, "held").state;
  expect(state.round.hands.human).toEqual([10, 11, 2]);
  state = finish(state);
  state = transitionMatch(
    state,
    { type: "NextRound", roundNumber: state.roundNumber },
    random,
  ).state;
  expect(state.rules.round).toBe(snapshot);
  expect(state.round.rules).toBe(snapshot);
  expect(state.trumpSetup!.human[0].instanceId).toBe("held");
});

// @req REQ-2026-020: initialization errors leave the deal stream untouched.
describe("review fixes at setup and observation boundaries", () => {
  it.each([
    {
      name: "missing explicit rules",
      rules: undefined,
      setup: prototypeSetup(["test-draw-2"]),
    },
    {
      name: "unknown definition",
      rules: PROTOTYPE_RULES,
      setup: prototypeSetup(["unknown"]),
    },
    {
      name: "duplicate instance IDs",
      rules: PROTOTYPE_RULES,
      setup: {
        human: [{ instanceId: "same", definitionId: "test-draw-2" }],
        ai: [{ instanceId: "same", definitionId: "test-target-24" }],
      },
    },
    {
      name: "empty instance ID",
      rules: PROTOTYPE_RULES,
      setup: {
        human: [{ instanceId: "", definitionId: "test-draw-2" }],
        ai: [],
      },
    },
  ])("rejects $name before the opening coin flip", ({ rules, setup }) => {
    const random = vi.fn(() => 0.25);
    expect(() => createMatch(random, rules, setup)).toThrow(RangeError);
    expect(random).not.toHaveBeenCalled();
  });

  it("returns a frozen trump observation without relying on observeRound", () => {
    const { state } = fixture(["test-draw-2"], ["test-return"]);
    const observation = observeTrumps(state.round.trumps!, "human");
    expect(observation.ownHand).toHaveLength(1);
    expect(observation.opponentHandCount).toBe(1);
    expect(Object.isFrozen(observation)).toBe(true);
    expect(Object.isFrozen(observation.ownHand)).toBe(true);
    expect(Object.isFrozen(observation.ownHand[0])).toBe(true);
    expect(Object.isFrozen(observation.table)).toBe(true);
    expect(Object.isFrozen(observation.discarded)).toBe(true);
    expect(() => Object.assign(observation, { opponentHandCount: 0 })).toThrow(
      TypeError,
    );
  });
});
