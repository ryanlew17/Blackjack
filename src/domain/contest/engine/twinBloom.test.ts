// @req REQ-2026-027: real command boundaries, private preparation and next-Turn copy invariants.
import { describe, expect, it, vi } from "vitest";
import type { NumberValue, PlayerId } from "../types";
import type { SkillId } from "../skills/catalog";
import { NUMBER_TRUMP_DEFINITIONS } from "../trumps/numberDefinitions";
import { INTERACTION_TRUMP_DEFINITIONS } from "../trumps/interactionDefinitions";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  projectMatchTransition,
  legalSkillCommands,
  legalTrumpCommands,
  legalMatchActions,
  generateNumber,
} from "./index";
import type {
  MatchState,
  MatchTransition,
  MatchCommand,
  RoundRules,
} from "./index";
import { fixedRandom } from "./testHelpers";
import { beginTurn } from "./triggers";
import { ledger } from "./interactionTestHelpers";

function fixture(
  options: {
    human?: SkillId;
    ai?: SkillId;
    first?: PlayerId;
    humanTrumps?: readonly string[];
    aiTrumps?: readonly string[];
    prefix?: readonly NumberValue[];
    stock?: Readonly<Record<string, number>>;
    selections?: readonly number[];
    effects?: readonly number[];
    noTrumps?: boolean;
  } = {},
) {
  const first = options.first ?? "ai";
  const numbers = [first === "human" ? 0.25 : 0.75],
    selections: number[] = [],
    effects = [...(options.effects ?? [])];
  const addRound = (prefix: readonly NumberValue[]) => {
    const shuffle = fixedRandom(prefix);
    for (let n = 0; n < 10; n++) numbers.push(shuffle());
  };
  addRound(options.prefix ?? [10, 8, 11, 9]);
  const unexpected = (): number => {
    throw new Error("Unexpected random stream");
  };
  const random = {
    numbers: vi.fn(() => (numbers.length ? numbers.shift()! : unexpected())),
    trumpGate: vi.fn(unexpected),
    trumpSelection: vi.fn(() =>
      selections.length ? selections.shift()! : unexpected(),
    ),
    skillSelection: vi.fn(unexpected),
    skillEffects: vi.fn(() =>
      effects.length ? effects.shift()! : unexpected(),
    ),
  };
  const human = options.humanTrumps ?? [],
    ai = options.aiTrumps ?? [];
  const rules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "danger",
      playableDifficulties: ["danger"],
      selected: {
        human: options.human ?? "twin-bloom",
        ai: options.ai ?? "spirit-sight",
      },
    },
    ...(options.noTrumps
      ? {}
      : {
          trumps: {
            tableCapacity: 5,
            definitions: {
              ...NUMBER_TRUMP_DEFINITIONS,
              ...INTERACTION_TRUMP_DEFINITIONS,
              noop: { onPlay: [] },
              "delete-self": {
                onPlay: [{ type: "delete-last-number", target: "self" }],
              },
              "gen-one": { onPlay: [{ type: "generate-number", value: 1 }] },
              "gen-hand": {
                onPlay: [{ type: "generate-trump", definitionId: "noop" }],
              },
            },
            ...(options.stock
              ? {
                  resources: {
                    difficulty: "danger",
                    handLimit: 8,
                    gameGrant: 2,
                    roundGrant: 1,
                    hitProbability: 0.5,
                    stock: options.stock,
                  },
                }
              : {}),
          },
        }),
  };
  if (options.stock) {
    if (human.length !== 3 || ai.length !== 3)
      throw new Error("Plan three initial grants each");
    const pool = Object.entries(options.stock).flatMap(([id, n]) =>
      Array<string>(n).fill(id),
    );
    const inventories = { human: [...pool], ai: [...pool] };
    const other = first === "human" ? "ai" : "human";
    for (const [player, n] of [
      [first, 0],
      [first, 1],
      [other, 0],
      [other, 1],
      [first, 2],
      [other, 2],
    ] as const) {
      const desired = (player === "human" ? human : ai)[n],
        inventory = inventories[player];
      const index = inventory.indexOf(desired);
      if (index < 0) throw new Error("Missing planned stock");
      selections.push((index + 0.5) / inventory.length);
      inventory.splice(index, 1);
    }
  }
  selections.push(...(options.selections ?? []));
  const setup =
    options.stock || options.noTrumps
      ? undefined
      : {
          human: human.map((id, i) => ({
            instanceId: "h-" + i,
            definitionId: id,
          })),
          ai: ai.map((id, i) => ({ instanceId: "a-" + i, definitionId: id })),
        };
  return { state: createMatch(random, rules, setup).state, random, addRound };
}
type Random = ReturnType<typeof fixture>["random"];
function pass(state: MatchState, random: Random) {
  const reaction = observeMatch(state, "human").round.reaction;
  if (!reaction) return state;
  const result = transitionMatch(
    state,
    {
      type: "PassReaction",
      player: reaction.player,
      turnNumber: reaction.turnNumber,
      reactionBoundary: reaction.boundary,
      roundNumber: state.roundNumber,
    },
    random,
  );
  expect(result.state).not.toBe(state);
  expect(result.events).toEqual([]);
  return result.state;
}
function prepare(state: MatchState, random: Random) {
  const player = observeMatch(state, "human").round.reaction!.player;
  const command = legalSkillCommands(observeMatch(state, player).round)[0];
  if (!command) throw new Error("Missing reaction command");
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
}
function act(
  state: MatchState,
  type: "Hit" | "Stay",
  random: Random,
): MatchTransition {
  state = pass(state, random);
  return transitionMatch(
    state,
    { type, player: state.round.turn!.player, roundNumber: state.roundNumber },
    random,
  );
}
function play(
  state: MatchState,
  definitionId: string,
  random: Random,
  targets: { targetId?: string; ownTargetId?: string } = {},
): MatchTransition {
  state = pass(state, random);
  const player = state.round.turn!.player;
  const instance = state.round.trumps!.hands[player].find(
    (c) => c.definitionId === definitionId,
  )!;
  const command = legalTrumpCommands(observeMatch(state, player).round).find(
    (c) =>
      c.instanceId === instance?.instanceId &&
      (!targets.targetId || c.targetId === targets.targetId) &&
      (!targets.ownTargetId || c.ownTargetId === targets.ownTargetId),
  );
  if (!command) throw new Error("Missing legal card " + definitionId);
  const result = transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
  expect(result.state).not.toBe(state);
  return result;
}
function finish(state: MatchState, random: Random) {
  for (let n = 0; n < 6 && state.phase === "playing"; n++)
    state = act(state, "Stay", random).state;
  expect(state.phase).not.toBe("playing");
  return state;
}
function assertNumbers(result: MatchTransition) {
  for (const s of [result.state, ...result.events.map((e) => e.state)]) {
    const round = s.round;
    const all = [
      ...round.hands.human,
      ...round.hands.ai,
      ...round.deck,
      ...round.deletedNumbers,
    ];
    expect(new Set(all.map((c) => c.instanceId)).size).toBe(all.length);
    expect(all.filter((c) => c.origin.type === "initial")).toHaveLength(11);
    expect(all.filter((c) => c.origin.type === "generated")).toHaveLength(
      round.nextNumberId - 1,
    );
    for (const player of ["human", "ai"] as const) {
      expect(round.hands[player][0].instanceId).toBe(round.hiddenCards[player]);
      expect(observeMatch(s, player).round.faceUpCardIds[player]).not.toContain(
        round.hiddenCards[player],
      );
    }
  }
}
function expectNoEffectRandom(random: Random) {
  expect(random.numbers).toHaveBeenCalledTimes(11);
  expect(random.trumpGate).not.toHaveBeenCalled();
  expect(random.skillSelection).not.toHaveBeenCalled();
  expect(random.skillEffects).not.toHaveBeenCalled();
}

describe("stable reaction authority", () => {
  it.each(["human", "ai"] as const)(
    "authorizes only %s to react before the other side's first decision",
    (player) => {
      const { state, random } = fixture(
        player === "human"
          ? {}
          : { human: "spirit-sight", ai: "twin-bloom", first: "human" },
      );
      const actor = state.round.turn!.player,
        own = observeMatch(state, player),
        other = observeMatch(state, actor);
      expect(own.round.reaction).toEqual({
        player,
        turnNumber: 1,
        boundary: 1,
      });
      expect(legalMatchActions(own)).toEqual(["ActivateSkill", "PassReaction"]);
      expect(legalMatchActions(other)).toEqual([]);
      expect(legalTrumpCommands(other.round)).toEqual([]);
      expect(legalSkillCommands(other.round)).toEqual([]);
      for (const command of [
        { type: "Hit", player },
        { type: "Stay", player },
        { type: "Hit", player: actor },
        { type: "Stay", player: actor },
        { type: "ResolveForcedTurn", player: actor, turnNumber: 1 },
      ] as const) {
        expect(
          transitionMatch(state, { ...command, roundNumber: 1 }, random),
        ).toEqual({ state, events: [] });
      }
      const passed = pass(state, random);
      expect(passed.round.reactionState!.passed).toBe(true);
      expect(passed.round.turn).toBe(state.round.turn);
      expect(passed.round.hands).toBe(state.round.hands);
      expect(passed.round.quietStays).toBe(state.round.quietStays);
      expect(passed.round.skills).toBe(state.round.skills);
      expect(legalMatchActions(observeMatch(passed, actor))).toContain("Stay");
      expectNoEffectRandom(random);
    },
  );
  it("rejects incorrect, missing, repeated and passed reaction authorizations without side effects", () => {
    const { state, random } = fixture();
    const command = {
      ...legalSkillCommands(observeMatch(state, "human").round)[0],
      roundNumber: 1,
    };
    for (const changed of [
      { player: "ai" },
      { skillId: "spirit-sight" },
      { turnNumber: 0 },
      { reactionBoundary: 0 },
      { reactionBoundary: undefined },
      { roundNumber: 0 },
    ]) {
      const result = transitionMatch(
        state,
        { ...command, ...changed } as MatchCommand,
        random,
      );
      expect(result).toEqual({ state, events: [] });
    }
    const prepared = prepare(state, random);
    expect(transitionMatch(prepared.state, command, random)).toEqual({
      state: prepared.state,
      events: [],
    });
    const passed = pass(state, random);
    expect(transitionMatch(passed, command, random)).toEqual({
      state: passed,
      events: [],
    });
    for (const changed of [
      { player: "ai" },
      { turnNumber: 0 },
      { reactionBoundary: 0 },
      { roundNumber: 0 },
    ]) {
      const result = transitionMatch(
        state,
        {
          type: "PassReaction",
          player: "human",
          turnNumber: 1,
          reactionBoundary: 1,
          roundNumber: 1,
          ...changed,
        } as MatchCommand,
        random,
      );
      expect(result).toEqual({ state, events: [] });
    }
    expectNoEffectRandom(random);
  });
  it("reopens only after a complete visible command and rejects the previous same-Turn boundary", () => {
    const { state, random } = fixture({ aiTrumps: ["noop", "noop"] });
    const old = {
      ...legalSkillCommands(observeMatch(state, "human").round)[0],
      roundNumber: 1,
    };
    const played = play(state, "noop", random);
    expect(played.state.round.turn!.number).toBe(1);
    expect(observeMatch(played.state, "human").round.reaction!.boundary).toBe(
      2,
    );
    expect(transitionMatch(played.state, old, random)).toEqual({
      state: played.state,
      events: [],
    });
    const paid = pass(played.state, random);
    const illegal = transitionMatch(
      paid,
      {
        type: "PlayTrump",
        player: "ai",
        instanceId: "missing",
        roundNumber: 1,
      },
      random,
    );
    expect(illegal).toEqual({ state: paid, events: [] });
    expect(observeMatch(paid, "human").round.reaction).toBeUndefined();
    const second = play(paid, "noop", random);
    expect(observeMatch(second.state, "human").round.reaction!.boundary).toBe(
      3,
    );
    expectNoEffectRandom(random);
  });
  it("does not turn an opponent's secret preparation into a new reaction window or sequence gap", () => {
    const { state, random } = fixture({ ai: "metamorphosis" });
    const allowed = pass(state, random);
    const command = legalSkillCommands(observeMatch(allowed, "ai").round)[0];
    const prepared = transitionMatch(
      allowed,
      { ...command, roundNumber: 1 },
      random,
    );
    expect(projectMatchTransition(prepared, "human")).toEqual({
      state: observeMatch(allowed, "human"),
      events: [],
    });
    expect(prepared.state.round.reactionState).toBe(
      allowed.round.reactionState,
    );
    const stayed = act(prepared.state, "Stay", random);
    expect(stayed.state.round.turn!.player).toBe("human");
    expect(stayed.state.round.reactionState!.boundary).toBe(2);
    expectNoEffectRandom(random);
  });
  it("opens a fresh opportunity after a public skill command without handing over the Turn", () => {
    const { state, random } = fixture();
    const allowed = pass(state, random);
    const command = legalSkillCommands(observeMatch(allowed, "ai").round)[0];
    const activated = transitionMatch(
      allowed,
      { ...command, roundNumber: 1 },
      random,
    );
    expect(activated.state.round.turn!.number).toBe(1);
    expect(
      observeMatch(activated.state, "human").round.reaction!.boundary,
    ).toBe(2);
    expectNoEffectRandom(random);
  });
  it("does not authorize an old boundary in intermediate Hit frames after handover but before resource supply completes", () => {
    const { state, random } = fixture({
      first: "human",
      stock: { noop: 5 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
      selections: [0],
    });
    random.trumpGate.mockImplementation(() => 0);
    const result = act(state, "Hit", random);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].state.round.turn!.player).toBe("ai");
    expect(
      observeMatch(result.events[0].state, "human").round.reaction,
    ).toBeUndefined();
    expect(observeMatch(result.state, "human").round.reaction).toEqual({
      player: "human",
      turnNumber: 2,
      boundary: 2,
    });
    expect(result.events.at(-1)!.state.round).toBe(result.state.round);
    ledger(result);
  });
  it("adds no reaction gate when neither selected skill can react", () => {
    const { state, random } = fixture({ human: "spirit-sight" });
    expect(state.round.reactionState).toBeUndefined();
    expect(observeMatch(state, "human").round.reaction).toBeUndefined();
    expect(legalMatchActions(observeMatch(state, "ai"))).toContain("Hit");
    expect(
      transitionMatch(
        state,
        {
          type: "PassReaction",
          player: "human",
          turnNumber: 1,
          reactionBoundary: 1,
          roundNumber: 1,
        },
        random,
      ),
    ).toEqual({ state, events: [] });
  });
  it.each(["human", "ai"] as const)(
    "keeps %s's preparation completely secret until its receiving Turn",
    (player) => {
      const { state, random } = fixture(
        player === "human"
          ? {}
          : { human: "spirit-sight", ai: "twin-bloom", first: "human" },
      );
      const other = state.round.turn!.player,
        before = observeMatch(state, other);
      const prepared = prepare(state, random);
      expect(projectMatchTransition(prepared, other)).toEqual({
        state: before,
        events: [],
      });
      expect(prepared.state.round.turn).toBe(state.round.turn);
      expect(prepared.state.round.quietStays).toBe(state.round.quietStays);
      expect(prepared.state.round.trumps).toBe(state.round.trumps);
      expect(prepared.state.round.skills!.players[player]).toMatchObject({
        remainingUses: 1,
        gameActivationsRemaining: 0,
      });
      expect(projectMatchTransition(prepared, player).events).toHaveLength(1);
      const declined = pass(state, random),
        accepted = pass(prepared.state, random);
      expect(observeMatch(accepted, other)).toEqual(
        observeMatch(declined, other),
      );
      expect(legalMatchActions(observeMatch(accepted, other))).toEqual(
        legalMatchActions(observeMatch(declined, other)),
      );
      expectNoEffectRandom(random);
    },
  );
});

describe("Twin Bloom at the receiving Turn", () => {
  it("does not snapshot or authorize hidden hand definitions during preparation", () => {
    const a = fixture({ aiTrumps: ["scry"] }),
      b = fixture({ aiTrumps: ["pressure"] });
    expect(observeMatch(a.state, "human")).toEqual(
      observeMatch(b.state, "human"),
    );
    expect(projectMatchTransition(prepare(a.state, a.random), "human")).toEqual(
      projectMatchTransition(prepare(b.state, b.random), "human"),
    );
  });
  it.each(["human", "ai"] as const)(
    "copies new %s instances and retains its own original logical hidden slot",
    (player) => {
      const { state, random } = fixture(
        player === "human"
          ? { humanTrumps: ["scry", "return"], aiTrumps: ["pressure", "noop"] }
          : {
              first: "human",
              human: "spirit-sight",
              ai: "twin-bloom",
              humanTrumps: ["pressure", "noop"],
              aiTrumps: ["scry", "return"],
            },
      );
      const actor = state.round.turn!.player;
      const result = act(prepare(state, random).state, "Stay", random),
        copied = result.state;
      expect(copied.round.hands[player][0]).toBe(state.round.hands[player][0]);
      expect(copied.round.hiddenCards).toBe(state.round.hiddenCards);
      expect(copied.round.hands[player].slice(1).map((c) => c.value)).toEqual(
        state.round.hands[actor].slice(1).map((c) => c.value),
      );
      expect(copied.round.hands[player][1].instanceId).not.toBe(
        state.round.hands[actor][1].instanceId,
      );
      expect(copied.round.hands[actor]).toBe(state.round.hands[actor]);
      expect(copied.round.deck).toBe(state.round.deck);
      expect(copied.round.trumps!.stock).toBe(state.round.trumps!.stock);
      expect(copied.round.trumps!.hands[actor]).toBe(
        state.round.trumps!.hands[actor],
      );
      expect(
        copied.round.trumps!.hands[player].map((c) => c.definitionId),
      ).toEqual(["pressure", "noop"]);
      for (const card of copied.round.trumps!.hands[player]) {
        expect(card.origin).toEqual({
          type: "generated",
          sourceId: "skill:twin-bloom:" + player + ":round-1",
        });
        expect(
          state.round.trumps!.hands[actor].some(
            (c) => c.instanceId === card.instanceId,
          ),
        ).toBe(false);
      }
      expect(copied.round.skills!.players[player]).toMatchObject({
        publicRemainingUses: 1,
        remainingUses: 1,
        gameActivationsRemaining: 0,
        activations: [{ public: true, status: "succeeded" }],
      });
      expect(copied.round.quietStays).toBe(1);
      expect(copied.round.turn).toEqual({
        player,
        number: 2,
        usedTrump: false,
      });
      expect(
        observeMatch(copied, actor).round.hands[player].cards[0].value,
      ).toBeNull();
      const projection = projectMatchTransition(result, actor);
      for (const event of projection.events)
        if (
          event.type === "round" &&
          event.event.type === "resource" &&
          event.event.player === player
        )
          expect(event.event.instance).toBeNull();
      expectNoEffectRandom(random);
      expect(random.trumpSelection).not.toHaveBeenCalled();
      assertNumbers(result);
    },
  );
  it("snapshots at effect time, including later numeric plays and newly generated hand cards", () => {
    const { state, random } = fixture({
      aiTrumps: ["draw-2", "gen-hand", "scry"],
    });
    let current = prepare(state, random).state;
    current = play(current, "draw-2", random).state;
    current = play(current, "gen-hand", random).state;
    const source = current.round.trumps!.hands.ai;
    const result = act(current, "Stay", random);
    expect(result.state.round.hands.human.slice(1).map((c) => c.value)).toEqual(
      [11, 2],
    );
    expect(
      result.state.round.trumps!.hands.human.map((c) => c.definitionId),
    ).toEqual(["scry", "noop"]);
    expect(result.state.round.trumps!.hands.ai).toBe(source);
    expect(result.state.round.trumps!.hands.human[1].origin).not.toEqual(
      source[1].origin,
    );
    expectNoEffectRandom(random);
    assertNumbers(result);
  });
  it("protects both logical hidden slots even after both have been publicly revealed", () => {
    const { state, random } = fixture({
      first: "human",
      humanTrumps: ["reveal-opponent"],
      aiTrumps: ["reveal-opponent"],
    });
    let current = play(state, "reveal-opponent", random).state;
    current = act(current, "Stay", random).state;
    current = play(current, "reveal-opponent", random).state;
    const result = act(prepare(current, random).state, "Stay", random);
    expect(result.state.round.revealed).toEqual(["ai", "human"]);
    expect(result.state.round.hands.human.map((c) => c.value)).toEqual([10, 9]);
    expect(result.state.round.hands.human[0]).toBe(state.round.hands.human[0]);
    expect(result.state.round.hands.ai[0]).toBe(state.round.hands.ai[0]);
    expect(
      observeMatch(result.state, "human").round.faceUpCardIds.human,
    ).toHaveLength(1);
    assertNumbers(result);
  });
  it("copies the effect-time hand after Self Renewal deletes a generated combination's largest face", () => {
    const { state, random } = fixture({
      ai: "self-renewal",
      aiTrumps: ["gen-one"],
    });
    let current = prepare(state, random).state;
    current = play(current, "gen-one", random).state;
    current = pass(current, random);
    const command = legalSkillCommands(observeMatch(current, "ai").round)[0];
    const renewed = transitionMatch(
      current,
      { ...command, roundNumber: 1 },
      random,
    );
    expect(renewed.state.round.hands.ai.map((c) => c.value)).toEqual([10, 1]);
    const result = act(renewed.state, "Stay", random);
    expect(result.state.round.hands.human.map((c) => c.value)).toEqual([8, 1]);
    expect(result.state.round.hands.human[1].instanceId).not.toBe(
      result.state.round.hands.ai[1].instanceId,
    );
    assertNumbers(renewed);
    assertNumbers(result);
    expectNoEffectRandom(random);
  });
  it("lets settlement Metamorphosis independently transform a generated one and its new Twin copy", () => {
    const { state, random } = fixture({
      ai: "metamorphosis",
      aiTrumps: ["gen-one"],
      effects: [0, 0.999],
    });
    let current = pass(state, random);
    const command = legalSkillCommands(observeMatch(current, "ai").round)[0];
    current = transitionMatch(
      current,
      { ...command, roundNumber: 1 },
      random,
    ).state;
    current = play(current, "gen-one", random).state;
    current = act(prepare(current, random).state, "Stay", random).state;
    const original = current.round.hands.ai.at(-1)!,
      copied = current.round.hands.human.at(-1)!;
    const result = act(act(current, "Stay", random).state, "Stay", random);
    expect(result.state.round.settlementValues![original.instanceId]).toBe(2);
    expect(result.state.round.settlementValues![copied.instanceId]).toBe(11);
    expect(original.value).toBe(1);
    expect(copied.value).toBe(1);
    expect(result.state.round.result!.totals).toEqual({ human: 30, ai: 23 });
    expect(random.skillEffects).toHaveBeenCalledTimes(2);
    expect(random.trumpSelection).not.toHaveBeenCalled();
    assertNumbers(result);
  });
  it("copies all eight hand cards after deleting its own full hand without stock draws or overflow", () => {
    const { state, random } = fixture({
      humanTrumps: Array<string>(8).fill("scry"),
      aiTrumps: Array<string>(8).fill("noop"),
    });
    const result = act(prepare(state, random).state, "Stay", random);
    expect(result.state.round.trumps!.hands.human).toHaveLength(8);
    expect(
      result.state.round.trumps!.destroyed.filter((c) => c.owner === "human"),
    ).toHaveLength(8);
    const bodies = [
      ...result.state.round.trumps!.hands.human,
      ...result.state.round.trumps!.hands.ai,
      ...result.state.round.trumps!.destroyed.map((c) => c.instance),
    ];
    expect(new Set(bodies.map((c) => c.instanceId)).size).toBe(24);
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expectNoEffectRandom(random);
  });
  it("preserves real stock quantities and origin ledgers when copying resource-backed hands", () => {
    const { state, random } = fixture({
      stock: { noop: 4, scry: 4, pressure: 4 },
      humanTrumps: ["scry", "scry", "noop"],
      aiTrumps: ["pressure", "pressure", "noop"],
    });
    const result = act(prepare(state, random).state, "Stay", random);
    expect(result.state.round.trumps!.stock).toBe(state.round.trumps!.stock);
    expect(random.trumpSelection).toHaveBeenCalledTimes(6);
    ledger(result);
    expectNoEffectRandom(random);
  });
  it("deletes its own faces and hand even when the effect-time source has neither", () => {
    const { state, random } = fixture({
      humanTrumps: ["scry"],
      aiTrumps: ["delete-self"],
    });
    const cleared = play(state, "delete-self", random).state;
    const result = act(prepare(cleared, random).state, "Stay", random);
    expect(result.state.round.hands.human).toEqual([
      state.round.hands.human[0],
    ]);
    expect(result.state.round.trumps!.hands.human).toEqual([]);
    expect(result.state.round.skills!.players.human.activations[0].status).toBe(
      "succeeded",
    );
    expectNoEffectRandom(random);
    assertNumbers(result);
  });
  it("spends and reveals a legal no-op when both players have only their hidden slots and no trumps", () => {
    const { state, random } = fixture({
      humanTrumps: ["delete-self"],
      aiTrumps: ["delete-self"],
    });
    let current = play(state, "delete-self", random).state;
    current = act(current, "Stay", random).state;
    current = play(current, "delete-self", random).state;
    current = act(current, "Stay", random).state;
    const prepared = prepare(current, random);
    const result = act(prepared.state, "Stay", random);
    expect(
      result.state.round.skills!.players.human.activations[0],
    ).toMatchObject({ status: "ineffective", public: true });
    expect(result.state.round.skills!.players.human.remainingUses).toBe(1);
    expect(result.state.round.hands).toBe(prepared.state.round.hands);
    expectNoEffectRandom(random);
  });
  it("copies numeric faces without a trump subsystem", () => {
    const { state, random } = fixture({ noTrumps: true });
    const result = act(prepare(state, random).state, "Stay", random);
    expect(result.state.round.hands.human.map((c) => c.value)).toEqual([8, 11]);
    expect(result.state.round.trumps).toBeUndefined();
    assertNumbers(result);
  });
  it("retains its own hidden multiplier, removes deleted bindings and suppression dependents, and copies raw values", () => {
    const { state, random } = fixture({
      first: "human",
      humanTrumps: ["face-lighten", "resonance"],
      aiTrumps: [
        "face-lighten",
        "suppress",
        "double-hidden",
        "trim",
        "resonance",
      ],
    });
    const ownFace = state.round.hands.human[1].instanceId,
      otherFace = state.round.hands.ai[1].instanceId;
    let current = play(state, "face-lighten", random, {
      targetId: ownFace,
    }).state;
    current = play(current, "resonance", random).state;
    current = act(current, "Stay", random).state;
    current = play(current, "face-lighten", random, {
      targetId: otherFace,
    }).state;
    const binding = current.round.trumps!.table.find(
      (t) => t.definitionId === "face-lighten",
    )!;
    current = play(current, "suppress", random, {
      targetId: binding.effectId,
    }).state;
    current = play(current, "double-hidden", random).state;
    const oldTarget = current.round.pointTarget;
    const result = act(prepare(current, random).state, "Stay", random),
      copied = result.state;
    expect(copied.round.hands.human.map((c) => c.value)).toEqual([10, 9]);
    expect(copied.round.hiddenMultipliers.human).toBe(2);
    expect(copied.round.trumps!.table.map((t) => t.definitionId)).toEqual([
      "resonance",
      "face-lighten",
    ]);
    expect(
      copied.round.trumps!.table.find((t) => t.definitionId === "face-lighten")!
        .cardId,
    ).toBe(otherFace);
    expect(copied.round.pointTarget).toBe(oldTarget);
    expect(observeMatch(copied, "human").round.hands.human.total).toBe(29);
    expect(observeMatch(copied, "human").round.hands.ai.visibleTotal).toBe(7);
    const trimmed = play(copied, "trim", random);
    expect(trimmed.state.round.hands.human).toEqual([
      state.round.hands.human[0],
    ]);
    const resonated = play(trimmed.state, "resonance", random);
    expect(resonated.state.round.pointTarget).toBe(22);
    assertNumbers(result);
    assertNumbers(trimmed);
    assertNumbers(resonated);
    expectNoEffectRandom(random);
  });
  it("clears the previous actual trump undo window instead of making the skill copy reversible", () => {
    const { state, random } = fixture({ aiTrumps: ["gen-one", "regret"] });
    const played = play(state, "gen-one", random).state;
    const result = act(prepare(played, random).state, "Stay", random),
      copied = result.state;
    expect(copied.round.lastPlay).toBeNull();
    expect(
      legalTrumpCommands(observeMatch(copied, "human").round).some(
        (c) => c.instanceId === copied.round.trumps!.hands.human[0].instanceId,
      ),
    ).toBe(false);
    expect(copied.round.hands.human.slice(1).map((c) => c.value)).toEqual([
      11, 1,
    ]);
    assertNumbers(result);
  });
  it("runs the common ordered Turn-start pass once and never repeats copy on direct resume", () => {
    const { state, random } = fixture({ aiTrumps: ["noop"] });
    const result = act(prepare(state, random).state, "Stay", random),
      copied = result.state;
    const repeated = beginTurn(copied.round, copied.round.turn!, random);
    expect(repeated).toEqual({ state: copied.round, events: [] });
    const continued = act(copied, "Hit", random).state;
    const later = act(continued, "Stay", random).state;
    expect(
      later.round.skills!.players.human.activations.filter(
        (a) => a.status === "succeeded",
      ),
    ).toHaveLength(1);
    expect(later.round.nextNumberId).toBe(copied.round.nextNumberId);
    expectNoEffectRandom(random);
  });
  it("permits both selected Twins to prepare on separate opposing Turns without recursively copying a copy", () => {
    const { state, random } = fixture({ ai: "twin-bloom", aiTrumps: ["noop"] });
    let current = act(prepare(state, random).state, "Hit", random).state;
    expect(current.round.hands.human.map((c) => c.value)).toEqual([8, 11, 1]);
    const humanCopy = current.round.hands.human[1].instanceId;
    current = act(prepare(current, random).state, "Stay", random).state;
    expect(current.round.hands.ai.map((c) => c.value)).toEqual([10, 11, 1]);
    expect(current.round.hands.ai[1].instanceId).not.toBe(humanCopy);
    expect(current.round.skills!.players.human.activations[0].status).toBe(
      "succeeded",
    );
    expect(current.round.skills!.players.ai.activations[0].status).toBe(
      "succeeded",
    );
    expect(current.round.nextNumberId).toBe(5);
    assertNumbers({ state: current, events: [] });
    expectNoEffectRandom(random);
  });
});

describe("copy lifecycle and other pending effects", () => {
  it("expires secretly when a second quiet Stay ends the Round before the receiving Turn", () => {
    const { state, random } = fixture({ first: "human" });
    const opposing = act(state, "Stay", random).state;
    expect(opposing.round.quietStays).toBe(1);
    const prepared = prepare(opposing, random);
    expect(projectMatchTransition(prepared, "ai")).toEqual({
      state: observeMatch(opposing, "ai"),
      events: [],
    });
    const result = act(prepared.state, "Stay", random);
    expect(result.state.phase).toBe("round-complete");
    expect(
      result.state.round.skills!.players.human.activations[0],
    ).toMatchObject({ public: false, status: "expired" });
    expect(result.state.round.skills!.players.human.publicRemainingUses).toBe(
      2,
    );
    expect(result.state.round.nextNumberId).toBe(1);
    expect(
      projectMatchTransition(result, "ai").events.some(
        (e) => e.type === "round" && e.event.type === "skill",
      ),
    ).toBe(false);
    expectNoEffectRandom(random);
  });
  // @req REQ-2026-029: Provoke ordering never adds a stock grant around Twin Bloom.
  it.each(["earlier", "later"] as const)(
    "orders the %s armed Provoke with copy without supplying",
    (order) => {
      const { state, random } = fixture({
        ai: "provoke",
        stock: { noop: 6 },
        humanTrumps: ["noop", "noop", "noop"],
        aiTrumps: ["noop", "noop", "noop"],
        selections: order === "earlier" ? [0] : [],
      });
      let current = state;
      const arm = (s: MatchState) => {
        s = pass(s, random);
        const command = legalSkillCommands(observeMatch(s, "ai").round)[0];
        return transitionMatch(s, { ...command, roundNumber: 1 }, random).state;
      };
      // Burn the responder's hand via real plays on its own previous Turn.
      // Its next preparation is still private; the source remains full for the effect-time snapshot.
      // This fixture uses a later activation rather than replacing any authority state.
      current = pass(current, random);
      current = act(current, "Stay", random).state;
      for (let n = 0; n < 3; n++) current = play(current, "noop", random).state;
      current = act(current, "Stay", random).state;
      if (order === "earlier") current = arm(current);
      current = prepare(current, random).state;
      if (order === "later") current = arm(current);
      const result = act(current, "Stay", random);
      const events = result.events
        .filter((e) => e.type === "round")
        .map((e) => e.event);
      const copy = events.findIndex(
        (e) =>
          e.type === "skill" &&
          e.skillId === "twin-bloom" &&
          e.status === "succeeded",
      );
      const provoke = events.findIndex(
        (e) => e.type === "skill" && e.skillId === "provoke",
      );
      expect(order === "earlier" ? provoke < copy : copy < provoke).toBe(true);
      expect(result.state.round.trumps!.hands.human).toHaveLength(3);
      expect(random.trumpSelection).toHaveBeenCalledTimes(6);
      ledger(result);
    },
  );
  it("runs earlier Bandwagon stock supply before replacing its hand with new copied instances", () => {
    const { state, random } = fixture({
      first: "human",
      stock: { bandwagon: 1, noop: 8 },
      humanTrumps: ["bandwagon", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let current = play(state, "bandwagon", random).state;
    current = act(current, "Stay", random).state;
    current = prepare(current, random).state;
    current = play(current, "noop", random).state;
    const remaining = current.round.trumps!.stock.human.length;
    const result = act(current, "Stay", random);
    const events = result.events
      .filter((e) => e.type === "round")
      .map((e) => e.event);
    const supplied = events.findIndex(
      (e) =>
        e.type === "resource" && e.operation === "draw" && e.player === "human",
    );
    const copied = events.findIndex(
      (e) => e.type === "skill" && e.skillId === "twin-bloom",
    );
    expect(supplied).toBeGreaterThanOrEqual(0);
    expect(supplied).toBeLessThan(copied);
    expect(result.state.round.trumps!.stock.human).toHaveLength(remaining - 1);
    expect(result.state.round.trumps!.hands.human).toHaveLength(2);
    expect(
      result.state.round.trumps!.hands.human.every(
        (c) => c.origin.type === "generated",
      ),
    ).toBe(true);
    expect(
      result.state.round.trumps!.destroyed.filter(
        (c) => c.owner === "human" && c.reason === "deleted",
      ),
    ).toHaveLength(3);
    // Bandwagon's named lookup is deterministic, so only the six initial ordinary grants sample.
    expect(random.trumpSelection).toHaveBeenCalledTimes(6);
    ledger(result);
  });
  it("copies before a pending Mind Grip takeover, then resolves the entire forced Turn once", () => {
    const { state, random } = fixture({ ai: "mind-grip", aiTrumps: ["noop"] });
    const allowed = pass(state, random),
      command = legalSkillCommands(observeMatch(allowed, "ai").round)[0];
    let current = transitionMatch(
      allowed,
      { ...command, roundNumber: 1 },
      random,
    ).state;
    current = prepare(current, random).state;
    const started = act(current, "Stay", random);
    expect(started.state.round.hands.human.map((c) => c.value)).toEqual([
      8, 11,
    ]);
    expect(started.state.round.turn).toMatchObject({
      player: "human",
      controlledBy: "ai",
    });
    const forced = transitionMatch(
      started.state,
      {
        type: "ResolveForcedTurn",
        player: "human",
        turnNumber: 2,
        roundNumber: 1,
      },
      random,
    );
    expect(forced.state.round.hands.human.map((c) => c.value)).toEqual([
      8, 11, 1, 2, 3,
    ]);
    expect(forced.state.round.turn!.number).toBe(3);
    expect(
      forced.events.filter((e) => e.type === "round" && e.event.type === "hit"),
    ).toHaveLength(3);
    assertNumbers(started);
    assertNumbers(forced);
  });
  it("rejects stale Round reactions and resets only Game permission while retaining the Match budget", () => {
    const { state, random, addRound } = fixture({ aiTrumps: ["noop"] });
    const old = {
      ...legalSkillCommands(observeMatch(state, "human").round)[0],
      roundNumber: 1,
    };
    let current = act(prepare(state, random).state, "Stay", random).state;
    for (let round = 1; round <= 15; round++) {
      if (round === 6) {
        current = act(current, "Stay", random).state;
        current = play(current, "noop", random).state;
        current = act(prepare(current, random).state, "Stay", random).state;
      }
      current = finish(current, random);
      if (round === 5) expect(current.phase).toBe("game-complete");
      if (round === 10) expect(current.phase).toBe("game-complete");
      if (round === 15) break;
      const nextFirst = current.round.firstPlayer === "human" ? "ai" : "human";
      addRound(nextFirst === "ai" ? [10, 8, 11, 9] : [8, 10, 9, 11]);
      current = transitionMatch(
        current,
        { type: "NextRound", roundNumber: current.roundNumber },
        random,
      ).state;
      expect(transitionMatch(current, old, random)).toEqual({
        state: current,
        events: [],
      });
      if (round === 5)
        expect(current.round.skills!.players.human).toMatchObject({
          remainingUses: 1,
          gameActivationsRemaining: 1,
          activations: [],
        });
      if (round === 10) {
        expect(current.round.skills!.players.human).toMatchObject({
          remainingUses: 0,
          publicRemainingUses: 0,
          gameActivationsRemaining: 1,
        });
        expect(observeMatch(current, "human").round.reaction).toBeUndefined();
      }
    }
    expect(current.phase).toBe("complete");
    expect(current.winner).toBe("ai");
    expect(random.numbers).toHaveBeenCalledTimes(151);
    expect(random.skillEffects).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, 99])(
    "rejects an invalid generated face insertion index %s without moving the hidden slot",
    (index) => {
      const { state } = fixture();
      expect(() =>
        generateNumber(state.round, "human", 1, "test-source", index),
      ).toThrow(RangeError);
      expect(state.round.hands.human[0].instanceId).toBe(
        state.round.hiddenCards.human,
      );
    },
  );
});
