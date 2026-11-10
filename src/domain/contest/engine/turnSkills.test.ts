// @req REQ-2026-027: real commands prove Turn-start supply, watched consumption and one controlled Turn.
import { describe, expect, it, vi } from "vitest";
import type { Difficulty, NumberValue, PlayerId } from "../types";
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
} from "./index";
import type {
  MatchState,
  MatchTransition,
  RoundRules,
  MatchCommand,
} from "./index";
import { HIT_PROBABILITIES } from "./resourceTypes";
import { fixedRandom } from "./testHelpers";
import { beginTurn } from "./triggers";
import { cleanupRound } from "./lifecycle";
import { ledger } from "./interactionTestHelpers";

function fixture(
  options: {
    human?: SkillId;
    ai?: SkillId;
    difficulty?: Difficulty;
    prefix?: readonly NumberValue[];
    humanTrumps?: readonly string[];
    aiTrumps?: readonly string[];
    stock?: Readonly<Record<string, number>>;
    selections?: readonly number[];
    gates?: readonly number[];
    effects?: readonly number[];
    drain?: number;
  } = {},
) {
  const numbers = [0.25],
    selections: number[] = [],
    gates = [...(options.gates ?? [])],
    effects = [...(options.effects ?? [])];
  const addRound = (prefix: readonly NumberValue[]) => {
    const source = fixedRandom(prefix);
    for (let n = 0; n < 10; n++) numbers.push(source());
  };
  addRound(options.prefix ?? [10, 8, 11, 9]);
  const unexpected = () => {
    throw new Error("Unexpected randomness");
  };
  const random = {
    numbers: vi.fn(() => (numbers.length ? numbers.shift()! : unexpected())),
    trumpSelection: vi.fn(() =>
      selections.length ? selections.shift()! : unexpected(),
    ),
    trumpGate: vi.fn(() => (gates.length ? gates.shift()! : unexpected())),
    skillSelection: vi.fn(unexpected),
    skillEffects: vi.fn(() =>
      effects.length ? effects.shift()! : unexpected(),
    ),
  };
  const difficulty = options.difficulty ?? "danger";
  const rules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty,
      playableDifficulties: [difficulty],
      selected: {
        human: options.human ?? "provoke",
        ai: options.ai ?? "spirit-sight",
      },
    },
    trumps: {
      tableCapacity: 5,
      definitions: {
        ...NUMBER_TRUMP_DEFINITIONS,
        ...INTERACTION_TRUMP_DEFINITIONS,
        noop: { onPlay: [] },
        "burn-hand": { cost: "all-other", onPlay: [] },
        drain: {
          onPlay: [
            { type: "draw-top", target: "self", count: options.drain ?? 1 },
          ],
        },
        fill: { onPlay: [{ type: "grant-trumps", target: "self", count: 7 }] },
      },
      ...(options.stock
        ? {
            resources: {
              difficulty,
              handLimit: 8,
              gameGrant: 2,
              roundGrant: 1,
              hitProbability: HIT_PROBABILITIES[difficulty],
              stock: options.stock,
            },
          }
        : {}),
    },
  };
  const human = options.humanTrumps ?? [],
    ai = options.aiTrumps ?? [];
  if (options.stock) {
    if (human.length !== 3 || ai.length !== 3)
      throw new Error("Resource fixture must plan three initial grants each");
    const stock = Object.entries(options.stock).flatMap(([id, n]) =>
      Array<string>(n).fill(id),
    );
    const inventories = { human: [...stock], ai: [...stock] };
    for (const [player, n] of [
      ["human", 0],
      ["human", 1],
      ["ai", 0],
      ["ai", 1],
      ["human", 2],
      ["ai", 2],
    ] as const) {
      const held = player === "human" ? human : ai,
        inventory = inventories[player],
        index = inventory.indexOf(held[n]);
      if (index < 0) throw new Error("Invalid planned stock");
      selections.push((index + 0.5) / inventory.length);
      inventory.splice(index, 1);
    }
  }
  selections.push(...(options.selections ?? []));
  const setup = options.stock
    ? undefined
    : {
        human: human.map((id, n) => ({
          instanceId: "h-" + n,
          definitionId: id,
        })),
        ai: ai.map((id, n) => ({ instanceId: "a-" + n, definitionId: id })),
      };
  return { state: createMatch(random, rules, setup).state, random, addRound };
}
type Random = ReturnType<typeof fixture>["random"];
function act(state: MatchState, type: "Hit" | "Stay", random: Random) {
  return transitionMatch(
    state,
    { type, player: state.round.turn!.player, roundNumber: state.roundNumber },
    random,
  );
}
function activate(state: MatchState, random: Random) {
  const command = legalSkillCommands(
    observeMatch(state, state.round.turn!.player).round,
  )[0];
  if (!command) throw new Error("Missing skill command");
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
}
function play(state: MatchState, id: string, random: Random) {
  const card = state.round.trumps!.hands[state.round.turn!.player].find(
    (c) => c.definitionId === id,
  )!;
  const command = legalTrumpCommands(
    observeMatch(state, state.round.turn!.player).round,
  ).find((c) => c.instanceId === card.instanceId);
  if (!command) throw new Error("Missing legal trump " + id);
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
}
function control(state: MatchState, random: Random) {
  return transitionMatch(
    state,
    {
      type: "ResolveForcedTurn",
      player: state.round.turn!.player,
      turnNumber: state.round.turn!.number,
      roundNumber: state.roundNumber,
    },
    random,
  );
}
function finish(original: MatchState, random: Random) {
  let state = original;
  const events: MatchTransition["events"][number][] = [];
  for (let n = 0; state.phase === "playing"; n++) {
    if (n > 20) throw new Error("Unexpected Turn loop");
    const result =
      state.round.turn?.controlledBy !== undefined
        ? control(state, random)
        : act(state, "Stay", random);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
const skills = (r: MatchTransition) =>
  r.events.flatMap((e) =>
    e.type === "round" && e.event.type === "skill" ? [e.event] : [],
  );
const resources = (r: MatchTransition) =>
  r.events.flatMap((e) =>
    e.type === "round" && e.event.type === "resource" ? [e.event] : [],
  );
const hits = (r: MatchTransition) =>
  r.events.flatMap((e) =>
    e.type === "round" && e.event.type === "hit" ? [e.event] : [],
  );
function reject(state: MatchState, command: MatchCommand, random: Random) {
  const calls = Object.values(random).map((rng) => rng.mock.calls.length);
  const result = transitionMatch(state, command, random);
  expect(result).toEqual({ state, events: [] });
  expect(result.state).toBe(state);
  expect(Object.values(random).map((rng) => rng.mock.calls.length)).toEqual(
    calls,
  );
}
function identities(result: MatchTransition) {
  for (const state of [result.state, ...result.events.map((e) => e.state)]) {
    const round = state.round,
      cards = [
        ...round.deck,
        ...round.hands.human,
        ...round.hands.ai,
        ...round.deletedNumbers,
      ];
    expect(cards).toHaveLength(11);
    expect(new Set(cards.map((c) => c.instanceId)).size).toBe(11);
    for (const player of ["human", "ai"] as const)
      expect(round.hands[player][0].instanceId).toBe(round.hiddenCards[player]);
  }
}
function emptyThenWatch(
  f: ReturnType<typeof fixture>,
  caster: PlayerId = "human",
) {
  let state = f.state;
  if (caster === "human") state = act(state, "Stay", f.random).state;
  state = play(state, "burn-hand", f.random).state;
  state = act(state, "Stay", f.random).state;
  state = activate(state, f.random).state;
  return act(state, "Stay", f.random);
}
const stock = {
  noop: 12,
  "burn-hand": 1,
  embargo: 1,
  bandwagon: 1,
  "safe-hit": 1,
  "supply-cache": 1,
  fill: 1,
};

describe("Turn skill command admission", () => {
  it.each([
    ["provoke", "human"],
    ["provoke", "ai"],
    ["mind-grip", "human"],
    ["mind-grip", "ai"],
  ] as const)(
    "%s spends once by %s and binds only the next opposing Turn",
    (id, player) => {
      let { state, random } = fixture({
        human: player === "human" ? id : "spirit-sight",
        ai: player === "ai" ? id : "spirit-sight",
      });
      if (player === "ai") state = act(state, "Stay", random).state;
      const before = state,
        command = legalSkillCommands(observeMatch(state, player).round)[0];
      const prepared = activate(state, random);
      state = prepared.state;
      expect(state.round.turn).toEqual({
        ...before.round.turn!,
        usedSkill: true,
      });
      expect(state.round.quietStays).toBe(0);
      expect(state.round.skills!.players[player]).toMatchObject({
        remainingUses: before.round.skills!.players[player].remainingUses - 1,
        gameActivationsRemaining: 0,
        activations: [
          {
            status: "prepared",
            effect: { type: id, targetTurn: before.round.turn!.number + 1 },
          },
        ],
      });
      reject(state, { ...command, roundNumber: state.roundNumber }, random);
      reject(
        before,
        {
          ...command,
          turnNumber: command.turnNumber + 1,
          roundNumber: state.roundNumber,
        },
        random,
      );
      reject(before, { ...command, roundNumber: 0 }, random);
      reject(
        before,
        {
          ...command,
          player: player === "human" ? "ai" : "human",
          roundNumber: state.roundNumber,
        },
        random,
      );
      expect(random.numbers).toHaveBeenCalledTimes(11);
      expect(random.skillEffects).not.toHaveBeenCalled();
    },
  );
});

// @req REQ-2026-029: Provocation never supplies the watched player.
describe("Provocation actual response", () => {
  it.each(["human", "ai"] as const)(
    "does not supply an empty target of %s before commands",
    (caster) => {
      const f = fixture({
        human: caster === "human" ? "provoke" : "spirit-sight",
        ai: caster === "ai" ? "provoke" : "spirit-sight",
        stock,
        humanTrumps:
          caster === "human"
            ? ["noop", "noop", "noop"]
            : ["burn-hand", "noop", "noop"],
        aiTrumps:
          caster === "human"
            ? ["burn-hand", "noop", "noop"]
            : ["noop", "noop", "noop"],
        selections: [0],
      });
      const result = emptyThenWatch(f, caster),
        state = result.state,
        target = caster === "human" ? "ai" : "human";
      expect(resources(result).filter((e) => e.cause === "trigger")).toEqual(
        [],
      );
      expect(state.round.trumps!.hands[target]).toHaveLength(0);
      expect(state.round.turn!.usedTrump).toBe(false);
      expect(state.round.skills!.players[caster].activations[0]).toMatchObject({
        status: "prepared",
        effect: {
          type: "provoke",
          phase: "watching",
          targetTurn: state.round.turn!.number,
        },
      });
      const projected = (player: PlayerId) =>
        projectMatchTransition(result, player).events.flatMap((e) =>
          e.type === "round" && e.event.type === "resource" ? [e.event] : [],
        );
      expect(projected(caster)).toEqual([]);
      expect(projected(target)).toEqual([]);
      const repeated = beginTurn(state.round, state.round.turn!, f.random);
      expect(repeated).toEqual({ state: state.round, events: [] });
      expect(repeated.state).toBe(state.round);
      expect(f.random.trumpSelection).toHaveBeenCalledTimes(6);
      expect(f.random.trumpGate).not.toHaveBeenCalled();
      expect(f.random.skillEffects).not.toHaveBeenCalled();
      ledger(result);
    },
  );
  it("does not supply a target who already has a trump", () => {
    let { state, random } = fixture({
      stock,
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    state = activate(state, random).state;
    const result = act(state, "Stay", random);
    expect(resources(result)).toEqual([]);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(3);
    expect(random.trumpSelection).toHaveBeenCalledTimes(6);
    expect(random.trumpGate).not.toHaveBeenCalled();
  });
  it("accepts a legal no-effect trump as a response and never adds 99", () => {
    let { state, random } = fixture({ aiTrumps: ["noop"] });
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    state = play(state, "noop", random).state;
    const ended = act(state, "Stay", random);
    expect(skills(ended).find((e) => e.skillId === "provoke")).toMatchObject({
      status: "ineffective",
    });
    const result = finish(ended.state, random);
    expect(result.state.round.result!.totals).toEqual({ human: 21, ai: 17 });
    expect(result.state.round.skills!.players.human.activations[0].status).toBe(
      "ineffective",
    );
    expect(skills(result).filter((e) => e.amount === 99)).toEqual([]);
    expect(random.skillEffects).not.toHaveBeenCalled();
  });
  it("records even a later-undone legal PlayTrump, instead of undoing the watched response", () => {
    let { state, random } = fixture({ aiTrumps: ["draw-2", "regret"] });
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    state = play(state, "draw-2", random).state;
    state = play(state, "regret", random).state;
    expect(state.round.hands.ai.map((c) => c.value)).toEqual([8, 9]);
    const result = finish(state, random);
    expect(result.state.round.result!.totals).toEqual({ human: 21, ai: 17 });
    expect(result.state.round.skills!.players.human.activations[0].status).toBe(
      "ineffective",
    );
  });
  it("Hit and its supply do not answer, and the penalty changes the authoritative winner exactly once", () => {
    let { state, random } = fixture({
      stock,
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
      prefix: [8, 10, 9, 11, 1],
      gates: [0],
      selections: [0],
    });
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    const hit = act(state, "Hit", random);
    state = hit.state;
    expect(resources(hit).filter((e) => e.cause === "hit")).toHaveLength(1);
    expect(state.round.skills!.players.human.activations[0]).toMatchObject({
      status: "prepared",
      effect: { type: "provoke", phase: "penalty" },
    });
    const result = finish(state, random);
    expect(result.state.round.result!.totals).toEqual({ human: 17, ai: 121 });
    expect(result.state.round.result!.winner).toBe("human");
    expect(result.state.game.points).toEqual({ human: 1, ai: 0 });
    expect(skills(result).filter((e) => e.amount === 99)).toHaveLength(1);
    reject(
      result.state,
      { type: "Stay", player: "ai", roundNumber: 1 },
      random,
    );
    expect(random.trumpGate).toHaveBeenCalledTimes(1);
    expect(random.trumpSelection).toHaveBeenCalledTimes(7);
    expect(random.skillEffects).not.toHaveBeenCalled();
    ledger(hit);
    ledger(result);
  });
  it("an active skill does not answer, and an illegal PlayTrump spends nothing or answers nothing", () => {
    let { state, random } = fixture();
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    reject(
      state,
      {
        type: "PlayTrump",
        player: "ai",
        instanceId: "missing",
        roundNumber: 1,
      },
      random,
    );
    state = activate(state, random).state;
    expect(state.round.turn!.usedTrump).toBe(false);
    const result = finish(state, random);
    expect(result.state.round.result!.totals.ai).toBe(116);
    expect(result.state.round.skills!.players.human.activations[0].status).toBe(
      "succeeded",
    );
    expect(random.skillEffects).not.toHaveBeenCalled();
  });
  it("lets an empty target Stay and applies 99 without any stock supply", () => {
    const f = fixture({
      stock: { "burn-hand": 1, noop: 2 },
      humanTrumps: ["burn-hand", "noop", "noop"],
      aiTrumps: ["burn-hand", "noop", "noop"],
    });
    const started = emptyThenWatch(f);
    expect(resources(started).filter((e) => e.cause === "trigger")).toEqual([]);
    expect(started.state.round.trumps!.hands.ai).toEqual([]);
    const result = finish(started.state, f.random);
    expect(skills(result).filter((e) => e.amount === 99)).toHaveLength(1);
    expect(f.random.trumpSelection).toHaveBeenCalledTimes(6);
    expect(
      result.state.round.skills!.players.human.gameActivationsRemaining,
    ).toBe(0);
    ledger(result);
  });
  it("does not consume the target's Embargo because Provocation grants nothing", () => {
    const f = fixture({
      stock,
      humanTrumps: ["embargo", "noop", "noop"],
      aiTrumps: ["burn-hand", "noop", "noop"],
    });
    let state = act(f.state, "Stay", f.random).state;
    state = play(state, "burn-hand", f.random).state;
    state = act(state, "Stay", f.random).state;
    state = play(state, "embargo", f.random).state;
    state = activate(state, f.random).state;
    const started = act(state, "Stay", f.random);
    expect(resources(started).filter((e) => e.operation === "blocked")).toEqual(
      [],
    );
    expect(started.state.round.trumps!.hands.ai).toEqual([]);
    expect(
      started.state.round.trumps!.table.some((t) => t.kind === "embargo"),
    ).toBe(true);
    expect(
      beginTurn(started.state.round, started.state.round.turn!, f.random)
        .events,
    ).toEqual([]);
    expect(f.random.trumpSelection).toHaveBeenCalledTimes(6);
    expect(
      skills(finish(started.state, f.random)).filter((e) => e.amount === 99),
    ).toHaveLength(1);
  });
  it("orders an earlier Bandwagon before Provocation without another supply", () => {
    let { state, random } = fixture({
      stock,
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["bandwagon", "burn-hand", "noop"],
    });
    state = act(state, "Stay", random).state;
    state = play(state, "bandwagon", random).state;
    state = play(state, "burn-hand", random).state;
    state = act(state, "Stay", random).state;
    state = activate(state, random).state;
    state = play(state, "noop", random).state;
    const record = state.round.trumps!.table.find(
      (t) => t.kind === "bandwagon",
    )!;
    expect(record.activationSequence).toBeLessThan(
      state.round.skills!.players.human.activations[0].sequence,
    );
    const result = act(state, "Stay", random);
    expect(
      resources(result).filter((e) => e.operation === "draw"),
    ).toHaveLength(1);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(1);
    expect(result.state.round.trumps!.hands.ai[0].definitionId).toBe("noop");
    expect(random.trumpSelection).toHaveBeenCalledTimes(6);
    expect(
      beginTurn(result.state.round, result.state.round.turn!, random),
    ).toEqual({ state: result.state.round, events: [] });
    ledger(result);
  });
  it("applies Metamorphosis first and the fixed penalty later without sampling the penalty", () => {
    let { state, random } = fixture({
      ai: "metamorphosis",
      prefix: [1, 8, 9, 2],
      effects: [0],
    });
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    state = activate(state, random).state;
    const result = finish(state, random);
    expect(
      skills(result)
        .filter((e) => e.status === "succeeded")
        .map((e) => [e.skillId, e.amount]),
    ).toEqual([
      ["metamorphosis", undefined],
      ["provoke", 99],
    ]);
    expect(result.state.round.result!.totals).toEqual({ human: 11, ai: 109 });
    expect(random.skillEffects).toHaveBeenCalledTimes(1);
  });
  it("clears watched effects at Round cleanup and never carries a penalty into the next Round", () => {
    let { state, random, addRound } = fixture();
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    const cleared = cleanupRound(state.round);
    expect(cleared.skills!.players.human.activations[0].status).toBe("expired");
    const result = finish(state, random);
    const remaining = result.state.round.skills!.players.human.remainingUses;
    addRound([10, 8, 11, 9]);
    state = transitionMatch(
      result.state,
      { type: "NextRound", roundNumber: 1 },
      random,
    ).state;
    expect(state.round.startedTurnNumber).toBe(1);
    expect(state.round.skills!.players.human.remainingUses).toBe(remaining);
    expect(state.round.skills!.players.human.gameActivationsRemaining).toBe(0);
    const ordinary = finish(state, random);
    expect(skills(ordinary).filter((e) => e.amount === 99)).toEqual([]);
    expect(ordinary.state.round.result!.totals).toEqual({ human: 17, ai: 21 });
    expect(random.skillEffects).not.toHaveBeenCalled();
  });
});

describe("Mind Grip finite controlled continuation", () => {
  it.each(["human", "ai"] as const)(
    "runs three Hits and one Stay for the opponent of %s in one Turn, even after bust",
    (caster) => {
      let { state, random } = fixture({
        human: caster === "human" ? "mind-grip" : "spirit-sight",
        ai: caster === "ai" ? "mind-grip" : "spirit-sight",
        prefix: [10, 8, 11, 9, 1, 2, 3],
      });
      if (caster === "ai") state = act(state, "Stay", random).state;
      state = activate(state, random).state;
      state = act(state, "Stay", random).state;
      const player = state.round.turn!.player,
        turn = state.round.turn!.number;
      const view = observeMatch(state, player).round;
      expect(view.turn!.controlledBy).toBe(caster);
      expect(legalMatchActions(observeMatch(state, player))).toEqual([
        "ResolveForcedTurn",
      ]);
      expect(legalTrumpCommands(view)).toEqual([]);
      expect(legalSkillCommands(view)).toEqual([]);
      for (const type of ["Hit", "Stay"] as const)
        reject(state, { type, player, roundNumber: 1 }, random);
      reject(
        state,
        {
          type: "ActivateSkill",
          player,
          skillId: "spirit-sight",
          turnNumber: turn,
          roundNumber: 1,
        },
        random,
      );
      const result = control(state, random);
      expect(hits(result)).toHaveLength(3);
      expect(hits(result).map((e) => e.card)).toEqual([1, 2, 3]);
      for (const event of hits(result))
        expect(event.state.turn).toMatchObject({
          player,
          number: turn,
          controlledBy: caster,
          usedTrump: false,
        });
      expect(
        result.events.filter(
          (e) => e.type === "round" && e.event.type === "stay",
        ),
      ).toHaveLength(1);
      expect(result.state.round.turn).toEqual({
        player: caster,
        number: turn + 1,
        usedTrump: false,
      });
      expect(result.state.round.quietStays).toBe(1);
      expect(
        result.state.round.skills!.players[caster].activations[0].status,
      ).toBe("succeeded");
      reject(
        result.state,
        { type: "ResolveForcedTurn", player, turnNumber: turn, roundNumber: 1 },
        random,
      );
      expect(random.trumpGate).not.toHaveBeenCalled();
      expect(random.skillEffects).not.toHaveBeenCalled();
      identities(result);
    },
  );
  it.each([0, 1, 2])(
    "draws only the %s available cards, without reshuffling, and then Stays",
    (available) => {
      let { state, random } = fixture({
        human: "mind-grip",
        humanTrumps: ["drain"],
        drain: 7 - available,
      });
      state = play(state, "drain", random).state;
      state = activate(state, random).state;
      state = act(state, "Stay", random).state;
      expect(state.round.deck).toHaveLength(available);
      const result = control(state, random);
      expect(hits(result)).toHaveLength(available);
      expect(result.state.round.deck).toHaveLength(0);
      expect(result.state.round.turn!.player).toBe("human");
      expect(random.numbers).toHaveBeenCalledTimes(11);
      identities(result);
    },
  );
  it("obeys active Hush, performs zero Hit gates and still automatically Stays", () => {
    let { state, random } = fixture({
      human: "mind-grip",
      humanTrumps: ["hush"],
    });
    state = play(state, "hush", random).state;
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    const result = control(state, random);
    expect(hits(result)).toEqual([]);
    expect(result.state.round.deck).toHaveLength(7);
    expect(
      result.state.round.trumps!.table.some((t) => t.kind === "hush"),
    ).toBe(false);
    expect(result.state.round.turn!.number).toBe(3);
    expect(result.state.round.quietStays).toBe(1);
    expect(random.trumpGate).not.toHaveBeenCalled();
    expect(random.trumpSelection).not.toHaveBeenCalled();
  });
  it("treats Heavy Hit as three ordinary two-card Hits, with three gates and one handover", () => {
    let { state, random } = fixture({
      human: "mind-grip",
      stock: { ...stock, "heavy-hit": 1 },
      humanTrumps: ["heavy-hit", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
      gates: [0.99, 0.99, 0.99],
    });
    state = play(state, "heavy-hit", random).state;
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    const result = control(state, random);
    expect(hits(result)).toHaveLength(6);
    expect(result.state.round.hands.ai).toHaveLength(8);
    expect(new Set(hits(result).map((e) => e.state.turn!.number))).toEqual(
      new Set([2]),
    );
    expect(result.state.round.turn!.number).toBe(3);
    expect(random.trumpGate).toHaveBeenCalledTimes(3);
    expect(random.trumpSelection).toHaveBeenCalledTimes(6);
    ledger(result);
  });
  it("reuses Safe Hit and Supply Cache once, then makes the remaining ordinary supply attempts", () => {
    let { state, random } = fixture({
      human: "mind-grip",
      stock,
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["safe-hit", "supply-cache", "noop"],
      prefix: [10, 8, 11, 9, 7, 1, 2],
      gates: [0, 0, 0],
      selections: [0, 0, 0, 0],
    });
    state = act(state, "Stay", random).state;
    state = play(state, "safe-hit", random).state;
    state = play(state, "supply-cache", random).state;
    state = act(state, "Stay", random).state;
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    const result = control(state, random);
    expect(hits(result).map((e) => e.card)).toEqual([7, 1, 2]);
    expect(result.state.round.hands.ai.map((c) => c.value)).toEqual([
      8, 9, 1, 2,
    ]);
    expect(
      resources(result).filter((e) => e.cause === "hit" && e.instance),
    ).toHaveLength(4);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(5);
    expect(random.trumpGate).toHaveBeenCalledTimes(3);
    expect(random.trumpSelection).toHaveBeenCalledTimes(10);
    expect(result.state.round.trumps!.table).toEqual([]);
    expect(result.state.round.deck.at(-1)!.value).toBe(7);
    ledger(result);
  });
  it("consumes an Embargo on the first successful gate, then permits the other two supplies", () => {
    let { state, random } = fixture({
      human: "mind-grip",
      stock,
      humanTrumps: ["embargo", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
      gates: [0, 0, 0],
      selections: [0, 0],
    });
    state = play(state, "embargo", random).state;
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    const result = control(state, random);
    expect(resources(result).map((e) => e.operation)).toEqual([
      "blocked",
      "draw",
      "draw",
    ]);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(5);
    expect(random.trumpGate).toHaveBeenCalledTimes(3);
    expect(random.trumpSelection).toHaveBeenCalledTimes(8);
    ledger(result);
  });
  it("keeps full-hand Hit gates but does not select hidden stock or exceed eight cards", () => {
    let { state, random } = fixture({
      human: "mind-grip",
      stock,
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["fill", "noop", "noop"],
      gates: [0, 0, 0],
      selections: [0, 0, 0, 0, 0, 0],
    });
    state = act(state, "Stay", random).state;
    state = play(state, "fill", random).state;
    state = act(state, "Stay", random).state;
    expect(state.round.trumps!.hands.ai).toHaveLength(8);
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    const remaining = state.round.trumps!.stock.ai,
      result = control(state, random);
    expect(resources(result)).toHaveLength(3);
    expect(resources(result).every((e) => e.instance === null)).toBe(true);
    expect(result.state.round.trumps!.stock.ai).toEqual(remaining);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(8);
    expect(random.trumpGate).toHaveBeenCalledTimes(3);
    expect(random.trumpSelection).toHaveBeenCalledTimes(12);
    ledger(result);
  });
  it("rejects wrong actor, old Turn, old Round and duplicate continuations with zero events/random", () => {
    let { state, random } = fixture({ human: "mind-grip" });
    state = activate(state, random).state;
    state = act(state, "Stay", random).state;
    for (const command of [
      {
        type: "ResolveForcedTurn",
        player: "human",
        turnNumber: 2,
        roundNumber: 1,
      },
      {
        type: "ResolveForcedTurn",
        player: "ai",
        turnNumber: 1,
        roundNumber: 1,
      },
      {
        type: "ResolveForcedTurn",
        player: "ai",
        turnNumber: 2,
        roundNumber: 0,
      },
      {
        type: "PlayTrump",
        player: "ai",
        instanceId: "missing",
        roundNumber: 1,
      },
    ] as const)
      reject(state, command, random);
    expect(beginTurn(state.round, state.round.turn!, random).state).toBe(
      state.round,
    );
    const result = control(state, random);
    reject(
      result.state,
      {
        type: "ResolveForcedTurn",
        player: "ai",
        turnNumber: 2,
        roundNumber: 1,
      },
      random,
    );
    expect(hits(result)).toHaveLength(3);
    expect(random.numbers).toHaveBeenCalledTimes(11);
  });
});

it("keeps an unanswered Provocation when the watched player activates Mind Grip, then settles after the controlled Turn", () => {
  let { state, random } = fixture({
    human: "mind-grip",
    ai: "provoke",
    prefix: [10, 8, 11, 9, 1, 2, 3],
  });
  state = act(state, "Stay", random).state;
  state = activate(state, random).state;
  state = act(state, "Stay", random).state;
  state = activate(state, random).state;
  state = act(state, "Stay", random).state;
  expect(state.round.skills!.players.ai.activations[0]).toMatchObject({
    status: "prepared",
    effect: { type: "provoke", phase: "penalty" },
  });
  const forced = control(state, random);
  expect(hits(forced)).toHaveLength(3);
  const result = finish(forced.state, random);
  expect(result.state.round.result!.totals).toEqual({ human: 120, ai: 23 });
  expect(result.state.round.result!.winner).toBe("ai");
  expect(skills(result).filter((e) => e.amount === 99)).toHaveLength(1);
  expect(result.state.round.skills!.players.human.activations[0].status).toBe(
    "succeeded",
  );
  expect(random.skillEffects).not.toHaveBeenCalled();
  identities(forced);
  identities(result);
});
it("clears takeover and completed records at a new Game while retaining the spent Match budget", () => {
  let { state, random, addRound } = fixture({
    human: "mind-grip",
    humanTrumps: ["sudden-death"],
  });
  state = play(state, "sudden-death", random).state;
  state = activate(state, random).state;
  state = act(state, "Stay", random).state;
  state = control(state, random).state;
  const result = finish(state, random);
  expect(result.state.phase).toBe("game-complete");
  expect(result.state.game.winner).toBe("human");
  expect(result.state.round.turn).toBeNull();
  expect(result.state.round.skills!.players.human.remainingUses).toBe(0);
  addRound([10, 8, 11, 9]);
  state = transitionMatch(
    result.state,
    { type: "NextRound", roundNumber: 1 },
    random,
  ).state;
  expect(state.round.turn).toEqual({
    player: "ai",
    number: 1,
    usedTrump: false,
  });
  expect(state.round.startedTurnNumber).toBe(1);
  expect(state.round.skills!.players.human).toMatchObject({
    remainingUses: 0,
    gameActivationsRemaining: 1,
    activations: [],
  });
  state = act(state, "Stay", random).state;
  expect(legalSkillCommands(observeMatch(state, "human").round)).toEqual([]);
  const ordinary = finish(state, random);
  expect(skills(ordinary).filter((e) => e.skillId === "mind-grip")).toEqual([]);
  expect(random.numbers).toHaveBeenCalledTimes(21);
  expect(random.skillEffects).not.toHaveBeenCalled();
});

it("never projects shared sequence gaps when a secret preparation precedes a public pending trump", () => {
  const run = (secret: boolean) => {
    let { state, random } = fixture({
      ai: "metamorphosis",
      aiTrumps: ["bandwagon"],
    });
    state = act(state, "Stay", random).state;
    if (secret) state = activate(state, random).state;
    return play(state, "bandwagon", random);
  };
  const hidden = run(true),
    plain = run(false);
  expect(projectMatchTransition(hidden, "human")).toEqual(
    projectMatchTransition(plain, "human"),
  );
  for (const player of ["human", "ai"] as const) {
    const view = projectMatchTransition(hidden, player);
    expect(JSON.stringify(view)).not.toContain("activationSequence");
    expect(JSON.stringify(view)).not.toContain("startedTurnNumber");
    expect(JSON.stringify(view)).not.toContain("nextActivationSequence");
  }
});
