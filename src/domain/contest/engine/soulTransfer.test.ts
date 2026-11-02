// @req REQ-2026-027: command-driven ownership, private interception, target/capacity resolution and actual inverses.
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
} from "./index";
import type {
  MatchState,
  MatchTransition,
  MatchCommand,
  RoundRules,
  PlayTrumpCommand,
} from "./index";
import { fixedRandom } from "./testHelpers";
import { ledger } from "./interactionTestHelpers";

function fixture(
  options: {
    human?: SkillId;
    ai?: SkillId;
    humanTrumps?: readonly string[];
    aiTrumps?: readonly string[];
    prefix?: readonly NumberValue[];
    stock?: Readonly<Record<string, number>>;
    selections?: readonly number[];
  } = {},
) {
  const numbers = [0.25],
    selections: number[] = [];
  const addRound = (prefix: readonly NumberValue[]) => {
    const shuffle = fixedRandom(prefix);
    for (let n = 0; n < 10; n++) numbers.push(shuffle());
  };
  addRound(options.prefix ?? [10, 8, 11, 9]);
  const unexpected = () => {
    throw new Error("Unexpected random stream");
  };
  const random = {
    numbers: vi.fn(() => (numbers.length ? numbers.shift()! : unexpected())),
    trumpGate: vi.fn(unexpected),
    trumpSelection: vi.fn(() =>
      selections.length ? selections.shift()! : unexpected(),
    ),
    skillEffects: vi.fn(unexpected),
    skillSelection: vi.fn(unexpected),
  };
  const rules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "standard",
      playableDifficulties: ["standard"],
      selected: {
        human: options.human ?? "soul-transfer",
        ai: options.ai ?? "spirit-sight",
      },
    },
    trumps: {
      tableCapacity: 5,
      definitions: {
        ...NUMBER_TRUMP_DEFINITIONS,
        ...INTERACTION_TRUMP_DEFINITIONS,
        noop: { onPlay: [] },
        "paid-draw": { cost: 1, onPlay: [{ type: "draw-number", value: 2 }] },
        "gen-one": { onPlay: [{ type: "generate-number", value: 1 }] },
        "delete-self": {
          onPlay: [{ type: "delete-last-number", target: "self" }],
        },
        "gen-two": {
          onPlay: [
            { type: "generate-trump", definitionId: "noop" },
            { type: "generate-trump", definitionId: "noop" },
          ],
        },
        "gen-three": {
          onPlay: [
            { type: "generate-trump", definitionId: "noop" },
            { type: "generate-trump", definitionId: "noop" },
            { type: "generate-trump", definitionId: "noop" },
          ],
        },
        "mixed-generate": {
          onPlay: [{ type: "generate-number", value: 1 }],
          table: { pointTarget: null, kind: "pressure" },
        },
      },
      ...(options.stock
        ? {
            resources: {
              difficulty: "standard",
              handLimit: 8,
              gameGrant: 2,
              roundGrant: 1,
              hitProbability: 0.3,
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
      throw new Error("Plan exactly three initial draws per side");
    const pool = Object.entries(options.stock).flatMap(([id, n]) =>
        Array<string>(n).fill(id),
      ),
      inventories = { human: [...pool], ai: [...pool] };
    for (const [player, n] of [
      ["human", 0],
      ["human", 1],
      ["ai", 0],
      ["ai", 1],
      ["human", 2],
      ["ai", 2],
    ] as const) {
      const cards = player === "human" ? human : ai,
        inventory = inventories[player],
        index = inventory.indexOf(cards[n]);
      if (index < 0) throw new Error("Missing planned card");
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
function skill(state: MatchState, random: Random) {
  const command = legalSkillCommands(
    observeMatch(state, state.round.turn!.player).round,
  )[0];
  if (!command) throw new Error("Missing skill");
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
}
function command(
  state: MatchState,
  id: string,
  options: Partial<PlayTrumpCommand> = {},
) {
  const player = state.round.turn!.player,
    card = state.round.trumps!.hands[player].find(
      (c) => c.definitionId === id,
    )!;
  const result = legalTrumpCommands(observeMatch(state, player).round).find(
    (c) =>
      c.instanceId === card.instanceId &&
      Object.entries(options).every(
        ([key, value]) => c[key as keyof PlayTrumpCommand] === value,
      ),
  );
  if (!result) throw new Error("Missing legal command " + id);
  return { ...result, roundNumber: state.roundNumber };
}
const play = (
  state: MatchState,
  id: string,
  random: Random,
  options: Partial<PlayTrumpCommand> = {},
) => transitionMatch(state, command(state, id, options), random);
function arm(f: ReturnType<typeof fixture>, caster: PlayerId = "human") {
  let state = f.state;
  if (caster === "ai") state = act(state, "Stay", f.random).state;
  state = skill(state, f.random).state;
  return act(state, caster === "ai" ? "Hit" : "Stay", f.random).state;
}
function finish(original: MatchState, random: Random) {
  let state = original;
  const events: MatchTransition["events"][number][] = [];
  for (let n = 0; state.phase === "playing"; n++) {
    if (n > 16) throw new Error("Stay loop");
    const r = act(state, "Stay", random);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}
const skillEvents = (r: MatchTransition) =>
  r.events.flatMap((e) =>
    e.type === "round" && e.event.type === "skill" ? [e.event] : [],
  );
const trumpEvents = (r: MatchTransition) =>
  r.events.flatMap((e) =>
    e.type === "round" && e.event.type === "trump" ? [e.event] : [],
  );
const resourceEvents = (r: MatchTransition) =>
  r.events.flatMap((e) =>
    e.type === "round" && e.event.type === "resource" ? [e.event] : [],
  );
const regret = (s: MatchState, p: PlayerId = "human") =>
  s.round.trumps!.hands[p].filter((c) => c.definitionId === "regret");
function reject(state: MatchState, c: MatchCommand, random: Random) {
  const before = Object.values(random).map((rng) => rng.mock.calls.length);
  const r = transitionMatch(state, c, random);
  expect(r).toEqual({ state, events: [] });
  expect(r.state).toBe(state);
  expect(Object.values(random).map((rng) => rng.mock.calls.length)).toEqual(
    before,
  );
}
function identities(r: MatchTransition) {
  for (const s of [r.state, ...r.events.map((e) => e.state)]) {
    const q = s.round,
      cards = [...q.deck, ...q.hands.human, ...q.hands.ai, ...q.deletedNumbers];
    expect(new Set(cards.map((c) => c.instanceId)).size).toBe(cards.length);
    expect(cards.filter((c) => c.origin.type === "initial")).toHaveLength(11);
    for (const p of ["human", "ai"] as const) {
      expect(q.hands[p][0].instanceId).toBe(q.hiddenCards[p]);
      expect(q.trumps!.hands[p].length).toBeLessThanOrEqual(8);
    }
    const bodies = [
      ...q.trumps!.hands.human,
      ...q.trumps!.hands.ai,
      ...q.trumps!.stock.human,
      ...q.trumps!.stock.ai,
      ...q.trumps!.destroyed.map((d) => d.instance),
    ];
    expect(new Set(bodies.map((c) => c.instanceId)).size).toBe(bodies.length);
  }
}

describe("Soul Transfer admission, secrecy and lifecycle", () => {
  it.each([0, 6, 7, 8])(
    "uses the strict initial hand boundary at %s cards",
    (count) => {
      const f = fixture({ humanTrumps: Array(count).fill("noop") }),
        view = observeMatch(f.state, "human").round;
      expect(legalSkillCommands(view)).toHaveLength(count < 7 ? 1 : 0);
      if (count >= 7)
        reject(
          f.state,
          {
            type: "ActivateSkill",
            player: "human",
            skillId: "soul-transfer",
            turnNumber: 1,
            roundNumber: 1,
          },
          f.random,
        );
      else {
        const r = skill(f.state, f.random);
        expect(r.state.round.trumps).toBe(f.state.round.trumps);
        expect(regret(r.state)).toHaveLength(0);
        expect(r.state.round.skills!.players.human).toMatchObject({
          remainingUses: 0,
          gameActivationsRemaining: 0,
        });
      }
      expect(f.random.skillEffects).not.toHaveBeenCalled();
    },
  );
  it("rejects a missing injected Regret before consuming any random stream", () => {
    const f = fixture(),
      rules = f.state.rules.round;
    const { regret: _missing, ...definitions } = rules.trumps!.definitions;
    expect(() =>
      createMatch(f.random, {
        ...rules,
        trumps: { ...rules.trumps!, definitions },
      }),
    ).toThrow(/Regret/);
    expect(f.random.numbers).toHaveBeenCalledTimes(11);
  });
  it("preserves the complete opposing observation/events/quiet state and gives only the owner exact pending state", () => {
    const f = fixture({ humanTrumps: ["noop"], aiTrumps: ["draw-2"] }),
      before = observeMatch(f.state, "ai"),
      prepared = skill(f.state, f.random);
    expect(projectMatchTransition(prepared, "ai")).toEqual({
      state: before,
      events: [],
    });
    expect(prepared.state.round.turn).toBe(f.state.round.turn);
    expect(prepared.state.round.quietStays).toBe(f.state.round.quietStays);
    expect(prepared.state.round.skills!.players.human.publicRemainingUses).toBe(
      1,
    );
    expect(
      observeMatch(prepared.state, "human").round.skills!.human.activations[0],
    ).toMatchObject({ status: "prepared", effect: { type: "soul-transfer" } });
    reject(
      prepared.state,
      {
        type: "ActivateSkill",
        player: "human",
        skillId: "soul-transfer",
        turnNumber: 1,
        roundNumber: 1,
      },
      f.random,
    );
    expect(resourceEvents(prepared)).toEqual([]);
    expect(f.random.trumpSelection).not.toHaveBeenCalled();
  });
  it.each(["human", "ai"] as const)(
    "keeps costs/card/turn with the original actor while %s receives the effect and one reward",
    (caster) => {
      const source = caster === "human" ? "ai" : "human",
        f = fixture({
          human: caster === "human" ? "soul-transfer" : "spirit-sight",
          ai: caster === "ai" ? "soul-transfer" : "spirit-sight",
          humanTrumps: source === "human" ? ["paid-draw", "noop"] : [],
          aiTrumps: source === "ai" ? ["paid-draw", "noop"] : [],
        });
      const state = arm(f, caster),
        turn = state.round.turn!,
        original = state.round.hands;
      const result = play(state, "paid-draw", f.random),
        s = result.state;
      expect(s.round.turn).toEqual({ ...turn, usedTrump: true });
      expect(s.round.hands[source]).toBe(original[source]);
      expect(s.round.hands[caster].at(-1)!.value).toBe(2);
      expect(s.round.lastPlay).toMatchObject({
        type: "trump",
        player: source,
        effectPlayer: caster,
      });
      expect(
        s.round
          .trumps!.destroyed.filter((d) => d.owner === source)
          .map((d) => d.reason),
      ).toEqual(["played", "cost"]);
      expect(regret(s, caster)).toHaveLength(1);
      expect(regret(s, caster)[0].origin).toMatchObject({ type: "generated" });
      expect(skillEvents(result)).toHaveLength(1);
      expect(skillEvents(result)[0]).toMatchObject({
        skillId: "soul-transfer",
        status: "succeeded",
      });
      const drawn = trumpEvents(result).find((e) => e.effect === "draw")!;
      expect(drawn).toMatchObject({
        player: source,
        effectPlayer: caster,
        card: 2,
      });
      const cost = (p: PlayerId) =>
        projectMatchTransition(result, p).events.flatMap((e) =>
          e.type === "round" &&
          e.event.type === "resource" &&
          e.event.cause === "cost"
            ? [e.event]
            : [],
        )[0];
      expect(cost(caster).instance).toBeNull();
      expect(cost(source).instance?.definitionId).toBe("noop");
      expect(
        observeMatch(s, source).round.skills![caster].knownRemainingUses.max,
      ).toBe(0);
      expect(f.random.skillEffects).not.toHaveBeenCalled();
      identities(result);
    },
  );
  it("leaves an invalid PlayTrump completely inert, including the hidden pending interception", () => {
    const f = fixture({ aiTrumps: ["paid-draw", "noop", "face-burden"] }),
      state = arm(f),
      valid = command(state, "paid-draw");
    for (const c of [
      { ...valid, costIds: [] },
      { ...valid, instanceId: "missing" },
      { ...valid, costIds: [valid.costIds![0], valid.costIds![0]] },
      { ...valid, roundNumber: 0 },
      { ...valid, player: "human" as const },
    ])
      reject(state, c, f.random);
    const burden = command(state, "face-burden");
    reject(
      state,
      { ...burden, targetId: state.round.hiddenCards.human! },
      f.random,
    );
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "prepared",
    );
    expect(regret(state)).toEqual([]);
    expect(skillEvents(play(state, "paid-draw", f.random))).toHaveLength(1);
  });
  it("waits across Hit/skill/Stay boundaries for the next legal PlayTrump and then intercepts only once", () => {
    const f = fixture({ aiTrumps: ["noop", "noop"] });
    let state = arm(f);
    state = skill(state, f.random).state;
    state = act(state, "Hit", f.random).state;
    state = act(state, "Stay", f.random).state;
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "prepared",
    );
    const first = play(state, "noop", f.random);
    state = first.state;
    const second = play(state, "noop", f.random);
    expect(skillEvents(first)).toHaveLength(1);
    expect(skillEvents(second)).toEqual([]);
    expect(regret(second.state)).toHaveLength(1);
    identities(second);
  });
  it("expires unrevealed without a reward, public count change or pending effect in the next Round", () => {
    const f = fixture();
    const state = arm(f),
      result = finish(state, f.random);
    expect(
      result.state.round.skills!.players.human.activations[0],
    ).toMatchObject({ status: "expired", public: false });
    expect(regret(result.state)).toEqual([]);
    expect(observeMatch(result.state, "ai").round.skills!.human).toMatchObject({
      knownRemainingUses: { min: 0, max: 1 },
      activations: [],
    });
    expect(
      projectMatchTransition(result, "ai").events.some(
        (e) => e.type === "round" && e.event.type === "skill",
      ),
    ).toBe(false);
    f.addRound([10, 8, 11, 9]);
    const next = transitionMatch(
      result.state,
      { type: "NextRound", roundNumber: 1 },
      f.random,
    );
    expect(next.state.round.skills!.players.human.remainingUses).toBe(0);
    expect(regret(next.state)).toEqual([]);
    expect(f.random.skillEffects).not.toHaveBeenCalled();
  });
  it("does not reflect a single play between two prepared Souls; each original play can consume only the opposing one", () => {
    const f = fixture({ ai: "soul-transfer", aiTrumps: ["draw-2"] });
    let state = arm(f);
    state = skill(state, f.random).state;
    const first = play(state, "draw-2", f.random);
    state = first.state;
    expect(skillEvents(first)).toHaveLength(1);
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "succeeded",
    );
    expect(state.round.skills!.players.ai.activations[0].status).toBe(
      "prepared",
    );
    state = act(state, "Stay", f.random).state;
    const second = play(state, "regret", f.random);
    expect(skillEvents(second)).toHaveLength(1);
    expect(second.state.round.skills!.players.ai.activations[0].status).toBe(
      "succeeded",
    );
    expect(second.state.round.hands.human.map((c) => c.value)).toEqual([
      10, 11,
    ]);
    expect(regret(second.state, "ai")).toHaveLength(1);
    identities(second);
  });
});

describe("redirected effect choices and capacity", () => {
  it.each(["face-lighten", "face-burden"] as const)(
    "reinterprets %s and deterministically falls back to the first legal face without touching hidden slots",
    (id) => {
      const f = fixture({ aiTrumps: [id] }),
        state = arm(f),
        original = command(state, id),
        result = transitionMatch(state, original, f.random);
      const target =
        id === "face-lighten"
          ? state.round.hands.human[1].instanceId
          : state.round.hands.ai[1].instanceId;
      expect(result.state.round.trumps!.table[0]).toMatchObject({
        owner: "human",
        cardId: target,
        sourceInstanceId: original.instanceId,
      });
      expect(target).not.toBe(original.targetId);
      expect(result.state.round.hiddenCards).toBe(state.round.hiddenCards);
      identities(result);
    },
  );
  it("retains a paid legal original cast when the controller has no legal face-up target", () => {
    const f = fixture({ humanTrumps: ["return"], aiTrumps: ["return"] });
    let state = play(f.state, "return", f.random).state;
    state = skill(state, f.random).state;
    state = act(state, "Stay", f.random).state;
    const hands = state.round.hands,
      deck = state.round.deck;
    const result = play(state, "return", f.random);
    expect(result.state.round.hands).toBe(hands);
    expect(result.state.round.deck).toBe(deck);
    expect(trumpEvents(result).at(-1)).toMatchObject({
      effect: "ineffective",
      effectPlayer: "human",
    });
    expect(
      result.state.round.trumps!.destroyed.some(
        (d) => d.instance.instanceId === "a-0" && d.reason === "played",
      ),
    ).toBe(true);
    expect(regret(result.state)).toHaveLength(1);
    expect(skillEvents(result)[0].status).toBe("succeeded");
    expect(result.state.round.lastPlay).toMatchObject({
      type: "trump",
      player: "ai",
      effectPlayer: "human",
      deltas: [],
    });
    identities(result);
  });
  it.each(["mixed-generate", "pressure-supply"])(
    "preflights the controller's full table before any %s onPlay or stock grant",
    (id) => {
      const f = fixture({
        humanTrumps: [
          "pressure",
          "shield",
          "risk-pledge",
          "supply-cache",
          "last-stand",
        ],
        aiTrumps: [id],
      });
      let state = f.state;
      for (const name of [
        "pressure",
        "shield",
        "risk-pledge",
        "supply-cache",
        "last-stand",
      ])
        state = play(state, name, f.random).state;
      state = skill(state, f.random).state;
      state = act(state, "Stay", f.random).state;
      const hands = state.round.hands,
        next = state.round.nextNumberId;
      const result = play(state, id, f.random);
      expect(result.state.round.hands).toBe(hands);
      expect(result.state.round.nextNumberId).toBe(next);
      expect(result.state.round.trumps!.table).toHaveLength(5);
      expect(resourceEvents(result)).toHaveLength(1);
      expect(resourceEvents(result)[0]).toMatchObject({
        operation: "generate",
        player: "human",
      });
      expect(trumpEvents(result).at(-1)!.effect).toBe("ineffective");
      expect(f.random.trumpSelection).not.toHaveBeenCalled();
      identities(result);
    },
  );
  it("can replace its own global target to free a slot on a full controller table", () => {
    const f = fixture({
      humanTrumps: [
        "target-17",
        "pressure",
        "shield",
        "last-stand",
        "supply-cache",
      ],
      aiTrumps: ["target-24"],
    });
    let state = f.state;
    for (const id of [
      "target-17",
      "pressure",
      "shield",
      "last-stand",
      "supply-cache",
    ])
      state = play(state, id, f.random).state;
    state = skill(state, f.random).state;
    state = act(state, "Stay", f.random).state;
    const result = play(state, "target-24", f.random);
    expect(result.state.round.trumps!.table).toHaveLength(5);
    expect(result.state.round.pointTarget).toBe(24);
    expect(
      result.state.round.trumps!.table.find(
        (t) => t.definitionId === "target-24",
      )!.owner,
    ).toBe("human");
    expect(trumpEvents(result).some((e) => e.effect === "ineffective")).toBe(
      false,
    );
  });
  it("does not count a replaced opposing target as a free controller slot", () => {
    const f = fixture({
      humanTrumps: [
        "pressure",
        "shield",
        "risk-pledge",
        "supply-cache",
        "last-stand",
      ],
      aiTrumps: ["target-17", "target-24"],
    });
    let state = act(f.state, "Stay", f.random).state;
    state = play(state, "target-17", f.random).state;
    state = act(state, "Stay", f.random).state;
    for (const id of [
      "pressure",
      "shield",
      "risk-pledge",
      "supply-cache",
      "last-stand",
    ])
      state = play(state, id, f.random).state;
    state = skill(state, f.random).state;
    state = act(state, "Stay", f.random).state;
    const result = play(state, "target-24", f.random);
    expect(result.state.round.pointTarget).toBe(17);
    expect(result.state.round.trumps!.table).toHaveLength(6);
    expect(trumpEvents(result).at(-1)!.effect).toBe("ineffective");
  });
  it.each([
    ["gen-two", 1],
    ["gen-three", 0],
  ] as const)(
    "rechecks the late hand capacity after %s; full hands do not block interception",
    (generator, rewards) => {
      const f = fixture({
        humanTrumps: [generator, ...Array(5).fill("noop")],
        aiTrumps: ["noop"],
      });
      let state = skill(f.state, f.random).state;
      state = play(state, generator, f.random).state;
      state = act(state, "Stay", f.random).state;
      const result = play(state, "noop", f.random);
      expect(regret(result.state)).toHaveLength(rewards);
      expect(result.state.round.trumps!.hands.human).toHaveLength(8);
      expect(
        result.state.round.skills!.players.human.activations[0].status,
      ).toBe("succeeded");
      expect(resourceEvents(result)[0].instance === null).toBe(rewards === 0);
      identities(result);
    },
  );
  it("grants the skill reward first, records only actual card-generated deltas and never restores the reward or costs on Undo", () => {
    const f = fixture({
      humanTrumps: Array(6).fill("noop"),
      aiTrumps: ["gen-two"],
    });
    let state = arm(f),
      result = play(state, "gen-two", f.random);
    state = result.state;
    expect(state.round.trumps!.hands.human).toHaveLength(8);
    expect(regret(state)).toHaveLength(1);
    expect(state.round.lastPlay).toMatchObject({
      deltas: [{ type: "trump-generated", player: "human" }],
    });
    state = act(state, "Stay", f.random).state;
    result = play(state, "regret", f.random);
    expect(result.state.round.trumps!.hands.human).toHaveLength(6);
    expect(regret(result.state)).toHaveLength(0);
    expect(result.state.round.skills!.players.human.remainingUses).toBe(0);
    identities(result);
  });
});

describe("redirected private/numeric effects and temporal bindings", () => {
  it("authorizes redirected Scry only to the controller in every payload and state, and Undo retains learned information", () => {
    const f = fixture({ aiTrumps: ["scry"] });
    let state = arm(f);
    const result = play(state, "scry", f.random);
    state = result.state;
    const event = (p: PlayerId) =>
      projectMatchTransition(result, p).events.flatMap((e) =>
        e.type === "round" &&
        e.event.type === "trump" &&
        e.event.effect === "peek"
          ? [e.event]
          : [],
      )[0];
    expect(event("human")).toMatchObject({
      player: "ai",
      effectPlayer: "human",
      privateCards: [1, 2],
    });
    expect(event("ai").privateCards).toBeUndefined();
    expect(observeMatch(state, "human").round.peek).toEqual([1, 2]);
    expect(observeMatch(state, "ai").round.peek).toBeNull();
    state = act(state, "Stay", f.random).state;
    const undone = play(state, "regret", f.random);
    expect(observeMatch(undone.state, "human").round.peek).toEqual([1, 2]);
    expect(f.random.skillEffects).not.toHaveBeenCalled();
  });
  it.each([
    "draw-2",
    "gen-one",
    "delete-self",
    "double-hidden",
    "reveal-opponent",
    "trim",
    "sudden-death",
  ])(
    "reinterprets the implicit self/opponent in %s and preserves original identities",
    (id) => {
      const f = fixture({ aiTrumps: [id], prefix: [1, 8, 11, 9] }),
        state = arm(f),
        result = play(state, id, f.random),
        round = result.state.round;
      if (id === "draw-2")
        expect(round.hands.human.map((c) => c.value)).toEqual([1, 11, 2]);
      if (id === "gen-one") {
        expect(round.hands.human.map((c) => c.value)).toEqual([1, 11, 1]);
        expect(round.hands.human.at(-1)!.origin).toEqual({
          type: "generated",
          sourceId: "a-0",
        });
      }
      if (id === "delete-self")
        expect(round.deletedNumbers.map((c) => c.value)).toEqual([11]);
      if (id === "double-hidden")
        expect(round.hiddenMultipliers).toEqual({ human: 1, ai: 2 });
      if (id === "reveal-opponent") {
        expect(round.revealed).toEqual(["ai"]);
        expect(
          observeMatch(result.state, "ai").round.hands.human.cards[0],
        ).toEqual({ value: null, faceDown: true });
      }
      if (id === "trim") {
        expect(round.hands.human.map((c) => c.value)).toEqual([1]);
        expect(round.deck.at(-1)!.instanceId).toBe(
          state.round.hands.human[1].instanceId,
        );
      }
      if (id === "sudden-death")
        expect(round.suddenDeath).toEqual({
          player: "human",
          sourceInstanceId: "a-0",
        });
      identities(result);
      expect(f.random.skillEffects).not.toHaveBeenCalled();
    },
  );
  it("does not normalize the original actor when the redirected self has no legal multiplier to normalize", () => {
    const f = fixture({
      humanTrumps: ["double-hidden"],
      aiTrumps: ["normalize"],
    });
    let state = play(f.state, "double-hidden", f.random).state;
    state = skill(state, f.random).state;
    state = act(state, "Stay", f.random).state;
    const result = play(state, "normalize", f.random);
    expect(result.state.round.hiddenMultipliers).toEqual({ human: 1, ai: 2 });
    expect(trumpEvents(result).at(-1)!.effect).toBe("ineffective");
  });
  it.each(["hush", "embargo", "target-lock", "heavy-hit"])(
    "binds redirected %s to the affected player's next actual Turn, not the controller's Turn",
    (id) => {
      const f = fixture({ aiTrumps: [id] }),
        state = arm(f),
        result = play(state, id, f.random),
        record = result.state.round.trumps!.table[0];
      expect(record).toMatchObject({
        owner: "human",
        affectedPlayer: "ai",
        expiresAfterTurn: 4,
      });
      let next = act(result.state, "Stay", f.random).state;
      expect(next.round.trumps!.table).toHaveLength(1);
      next = act(next, "Stay", f.random).state;
      expect(next.round.turn!.number).toBe(4);
      expect(next.round.trumps!.table).toHaveLength(1);
      if (id === "hush")
        reject(next, { type: "Hit", player: "ai", roundNumber: 1 }, f.random);
      const ended = act(next, "Stay", f.random);
      expect(ended.state.round.trumps!.table).toEqual([]);
    },
  );
  it("retargets Suppress stably and preserves its exact next-turn expiry", () => {
    const f = fixture({
      humanTrumps: ["pressure"],
      aiTrumps: ["shield", "pressure", "suppress"],
    });
    let state = play(f.state, "pressure", f.random).state;
    state = act(state, "Stay", f.random).state;
    state = play(state, "shield", f.random).state;
    state = play(state, "pressure", f.random).state;
    state = act(state, "Stay", f.random).state;
    state = skill(state, f.random).state;
    state = act(state, "Stay", f.random).state;
    const original = command(state, "suppress"),
      first = state.round.trumps!.table.find((t) => t.owner === "ai")!,
      result = transitionMatch(state, original, f.random);
    expect(result.state.round.trumps!.table.at(-1)).toMatchObject({
      owner: "human",
      targetEffectId: first.effectId,
      affectedPlayer: "ai",
      expiresAfterTurn: 6,
    });
    expect(original.targetId).not.toBe(first.effectId);
  });
});

describe("source consumption, redirected resources and actual Undo", () => {
  const stock = {
    noop: 12,
    harvest: 1,
    "resource-swap": 1,
    pressure: 3,
    "banish-copy": 1,
    bandwagon: 1,
  };
  it("keeps original costs/triggers separate from redirected grants, and Undo reverses every actual card/trigger delta without refunding the skill reward or RNG", () => {
    const f = fixture({
      stock,
      humanTrumps: ["harvest", "noop", "noop"],
      aiTrumps: ["harvest", "resource-swap", "noop"],
      selections: [0, 0, 0, 0],
    });
    let state = play(f.state, "harvest", f.random).state;
    state = act(state, "Stay", f.random).state;
    state = play(state, "harvest", f.random).state;
    state = act(state, "Stay", f.random).state;
    state = skill(state, f.random).state;
    state = act(state, "Stay", f.random).state;
    const before = state.round.trumps!,
      result = play(state, "resource-swap", f.random);
    state = result.state;
    const charges = (s: MatchState, p: PlayerId) =>
      s.round.trumps!.table.find((t) => t.kind === "harvest" && t.owner === p)!
        .remainingCharges;
    expect(charges(state, "human")).toBe(2);
    expect(charges(state, "ai")).toBe(1);
    expect(state.round.trumps!.hands.human).toHaveLength(5);
    expect(state.round.trumps!.hands.ai).toHaveLength(1);
    expect(state.round.trumps!.stock.human).toHaveLength(
      before.stock.human.length - 2,
    );
    expect(state.round.trumps!.stock.ai).toHaveLength(
      before.stock.ai.length - 1,
    );
    expect(
      resourceEvents(result)
        .filter((e) => e.operation === "draw")
        .map((e) => [e.player, e.cause]),
    ).toEqual([
      ["human", "effect"],
      ["human", "effect"],
      ["ai", "trigger"],
    ]);
    expect(state.round.lastPlay).toMatchObject({
      player: "ai",
      effectPlayer: "human",
      deltas: [
        { type: "trump-granted", player: "human" },
        { type: "trump-granted", player: "human" },
        { type: "effect-updated" },
        { type: "trump-granted", player: "ai" },
      ],
    });
    const stockAfter = state.round.trumps!.stock;
    state = act(state, "Stay", f.random).state;
    const undone = play(state, "regret", f.random);
    state = undone.state;
    expect(state.round.trumps!.hands.human).toHaveLength(3);
    expect(state.round.trumps!.hands.ai).toHaveLength(0);
    expect(charges(state, "human")).toBe(1);
    expect(charges(state, "ai")).toBe(2);
    expect(state.round.trumps!.stock.ai).toEqual(stockAfter.ai);
    expect(state.round.trumps!.stock.human).toHaveLength(
      stockAfter.human.length - 1,
    );
    expect(
      state.round.trumps!.destroyed.filter(
        (d) => d.owner === "ai" && d.reason === "cost",
      ),
    ).toHaveLength(1);
    expect(state.round.skills!.players.human).toMatchObject({
      remainingUses: 0,
      gameActivationsRemaining: 0,
      activations: [{ status: "succeeded" }],
    });
    expect(f.random.trumpSelection).toHaveBeenCalledTimes(10);
    expect(f.random.skillEffects).not.toHaveBeenCalled();
    projectMatchTransition(result, "human");
    projectMatchTransition(result, "ai");
    expect(f.random.trumpSelection).toHaveBeenCalledTimes(10);
    ledger(result);
    ledger(undone);
  });
  it("preserves an explicit public stock declaration under the new opponent perspective and restores deleted stock as a new generated identity", () => {
    const f = fixture({
      stock,
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["banish-copy", "noop", "noop"],
    });
    let state = arm(f),
      humanStock = state.round.trumps!.stock.human,
      old = state.round.trumps!.stock.ai.find(
        (c) => c.definitionId === "pressure",
      )!;
    const result = play(state, "banish-copy", f.random, {
      definitionId: "pressure",
    });
    state = result.state;
    expect(state.round.trumps!.stock.human).toBe(humanStock);
    expect(
      state.round.trumps!.stock.ai.some((c) => c.instanceId === old.instanceId),
    ).toBe(false);
    expect(
      resourceEvents(result).find((e) => e.operation === "delete"),
    ).toMatchObject({ player: "ai", definitionId: "pressure", instance: old });
    state = act(state, "Stay", f.random).state;
    const undone = play(state, "regret", f.random);
    state = undone.state;
    const restored = state.round.trumps!.stock.ai.filter(
      (c) => c.definitionId === "pressure" && c.origin.type === "generated",
    );
    expect(restored).toHaveLength(1);
    expect(restored[0].instanceId).not.toBe(old.instanceId);
    expect(state.round.trumps!.destroyed.some((d) => d.instance === old)).toBe(
      true,
    );
    expect(f.random.trumpSelection).toHaveBeenCalledTimes(6);
    ledger(result);
    ledger(undone);
  });
  it("redirects Bandwagon to watch the source player's next Turn and retrieves from the controller's stock", () => {
    const f = fixture({
      stock,
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["bandwagon", "noop", "pressure"],
    });
    let state = arm(f);
    state = play(state, "bandwagon", f.random).state;
    expect(state.round.trumps!.table[0]).toMatchObject({
      owner: "human",
      watchedTurn: 4,
    });
    state = play(state, "noop", f.random).state;
    expect(state.round.trumps!.table[0].copiedDefinitionId).toBeUndefined();
    state = act(state, "Stay", f.random).state;
    state = act(state, "Stay", f.random).state;
    state = play(state, "pressure", f.random).state;
    expect(
      state.round.trumps!.table.find((t) => t.kind === "bandwagon")!
        .copiedDefinitionId,
    ).toBe("pressure");
    const result = act(state, "Stay", f.random);
    expect(result.state.round.turn!.number).toBe(5);
    const grant = resourceEvents(result).find((e) => e.cause === "trigger")!;
    expect(grant).toMatchObject({
      player: "human",
      instance: {
        definitionId: "pressure",
        origin: { owner: "human", type: "stock" },
      },
    });
    expect(
      result.state.round.trumps!.table.some((t) => t.kind === "bandwagon"),
    ).toBe(false);
    expect(f.random.trumpSelection).toHaveBeenCalledTimes(6);
    ledger(result);
  });
});

it("falls back stably for both table-exchange selectors and Undo restores actual control without recreating the original card", () => {
  const f = fixture({
    humanTrumps: ["pressure", "shield"],
    aiTrumps: ["pressure", "shield", "table-exchange"],
  });
  let state = f.state;
  for (const id of ["pressure", "shield"])
    state = play(state, id, f.random).state;
  state = act(state, "Stay", f.random).state;
  for (const id of ["pressure", "shield"])
    state = play(state, id, f.random).state;
  state = act(state, "Stay", f.random).state;
  state = skill(state, f.random).state;
  state = act(state, "Stay", f.random).state;
  const table = state.round.trumps!.table,
    own = table.find((t) => t.owner === "human" && t.kind === "pressure")!,
    other = table.find((t) => t.owner === "ai" && t.kind === "pressure")!;
  const selectors = {
    ownTargetId: table.find((t) => t.owner === "ai" && t.kind === "shield")!
      .effectId,
    targetId: table.find((t) => t.owner === "human" && t.kind === "shield")!
      .effectId,
  };
  const result = play(state, "table-exchange", f.random, selectors);
  state = result.state;
  expect(
    state.round.trumps!.table.find((t) => t.effectId === own.effectId)!.owner,
  ).toBe("ai");
  expect(
    state.round.trumps!.table.find((t) => t.effectId === other.effectId)!.owner,
  ).toBe("human");
  state = act(state, "Stay", f.random).state;
  const undone = play(state, "regret", f.random);
  expect(undone.state.round.trumps!.table).toEqual(table);
  expect(undone.state.round.trumps!.hands.ai).toEqual([]);
  identities(result);
  identities(undone);
});
it("preflights redirected Undo after the skill reward fills a restoration slot, retaining the original payment on failure", () => {
  const f = fixture({
    humanTrumps: ["gen-three", ...Array(5).fill("noop")],
    aiTrumps: ["regret", "regret"],
  });
  let state = play(f.state, "gen-three", f.random).state;
  expect(state.round.trumps!.hands.human).toHaveLength(8);
  state = act(state, "Stay", f.random).state;
  state = play(state, "regret", f.random).state;
  expect(state.round.trumps!.hands.human).toHaveLength(5);
  state = act(state, "Stay", f.random).state;
  state = skill(state, f.random).state;
  state = act(state, "Stay", f.random).state;
  const original = command(state, "regret"),
    result = transitionMatch(state, original, f.random);
  expect(trumpEvents(result).at(-1)!.effect).toBe("ineffective");
  expect(result.state.round.trumps!.hands.human).toHaveLength(6);
  expect(regret(result.state)).toHaveLength(1);
  expect(result.state.round.trumps!.hands.ai).toEqual([]);
  expect(result.state.round.lastPlay).toMatchObject({
    type: "trump",
    deltas: [],
  });
  expect(skillEvents(result)[0].status).toBe("succeeded");
  identities(result);
});

it("clears Soul state/reward at Game completion while retaining its Match budget and frozen rules", () => {
  const f = fixture({ aiTrumps: ["sudden-death"] });
  let state = arm(f);
  state = play(state, "sudden-death", f.random).state;
  const ended = finish(state, f.random);
  expect(ended.state.phase).toBe("game-complete");
  expect(ended.state.wins.human).toBe(1);
  expect(ended.state.round.trumps!.hands.human).toEqual([]);
  f.addRound([10, 8, 11, 9]);
  state = transitionMatch(
    ended.state,
    { type: "NextRound", roundNumber: 1 },
    f.random,
  ).state;
  expect(state.rules).toBe(f.state.rules);
  expect(state.round.skills!.players.human).toMatchObject({
    remainingUses: 0,
    gameActivationsRemaining: 1,
    activations: [],
  });
  const original = command(state, "sudden-death"),
    next = transitionMatch(state, original, f.random);
  expect(skillEvents(next)).toEqual([]);
  expect(regret(next.state)).toEqual([]);
  expect(next.state.round.suddenDeath!.player).toBe("ai");
  reject(state, { ...original, roundNumber: 1 }, f.random);
  expect(f.random.numbers).toHaveBeenCalledTimes(21);
});

it("lets the original actor Undo the redirected effect in the same Turn while the independent skill reward remains held", () => {
  const f = fixture({ aiTrumps: ["paid-draw", "noop", "regret"] });
  let state = arm(f);
  const beforeDeck = state.round.deck;
  state = play(state, "paid-draw", f.random).state;
  const reward = regret(state)[0],
    number = state.round.hands.human.at(-1)!;
  const result = play(state, "regret", f.random);
  expect(result.state.round.hands.human.map((c) => c.value)).toEqual([10, 11]);
  expect(result.state.round.deck).toEqual(beforeDeck);
  expect(
    result.state.round.deck.find((c) => c.instanceId === number.instanceId),
  ).toBe(number);
  expect(regret(result.state)).toEqual([reward]);
  expect(result.state.round.turn).toEqual({
    player: "ai",
    number: 2,
    usedTrump: true,
  });
  expect(skillEvents(result)).toEqual([]);
  expect(
    result.state.round.trumps!.destroyed.filter((d) => d.owner === "ai"),
  ).toHaveLength(3);
  identities(result);
});
