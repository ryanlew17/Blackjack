// @req REQ-2026-027: command-driven settlement, secret equivalence and continuing first-player rotation.
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
  RoundObservation,
  RoundRules,
} from "./index";
import { fixedRandom } from "./testHelpers";
import { effectiveTotals } from "./contributions";

function fixture(
  options: {
    human?: SkillId;
    ai?: SkillId;
    prefix?: readonly NumberValue[];
    samples?: readonly number[];
    humanTrumps?: readonly string[];
    aiTrumps?: readonly string[];
  } = {},
) {
  const numbers = [0.25];
  const addRound = (prefix: readonly NumberValue[]) => {
    const source = fixedRandom(prefix);
    for (let i = 0; i < 10; i++) numbers.push(source());
  };
  addRound(options.prefix ?? [10, 8, 11, 9]);
  const samples = [...(options.samples ?? [])];
  const unexpected = () => {
    throw new Error("Unexpected random consumption");
  };
  const random = {
    numbers: vi.fn(() => (numbers.length ? numbers.shift()! : unexpected())),
    skillEffects: vi.fn(() =>
      samples.length ? samples.shift()! : unexpected(),
    ),
    skillSelection: vi.fn(unexpected),
    trumpGate: vi.fn(unexpected),
    trumpSelection: vi.fn(unexpected),
  };
  const rules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "standard",
      playableDifficulties: ["standard"],
      selected: {
        human: options.human ?? "tempt-fate",
        ai: options.ai ?? "spirit-sight",
      },
    },
    trumps: {
      tableCapacity: 5,
      definitions: {
        ...NUMBER_TRUMP_DEFINITIONS,
        ...INTERACTION_TRUMP_DEFINITIONS,
        "gen-one": { onPlay: [{ type: "generate-number", value: 1 }] },
        "gen-six": { onPlay: [{ type: "generate-number", value: 6 }] },
        "gen-ten": { onPlay: [{ type: "generate-number", value: 10 }] },
        "gen-eleven": { onPlay: [{ type: "generate-number", value: 11 }] },
        "double-self": {
          onPlay: [{ type: "hidden-multiplier", target: "self", value: 2 }],
        },
      },
    },
  };
  const setup = {
    human: (options.humanTrumps ?? []).map((id, n) => ({
      instanceId: "h-" + n,
      definitionId: id,
    })),
    ai: (options.aiTrumps ?? []).map((id, n) => ({
      instanceId: "a-" + n,
      definitionId: id,
    })),
  };
  const state = createMatch(random, rules, setup).state;
  return { state, random, addRound };
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
  if (!command) throw new Error("Missing legal skill command");
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
}
function play(
  state: MatchState,
  id: string,
  random: Random,
  targetId?: string,
) {
  const player = state.round.turn!.player;
  const card = state.round.trumps!.hands[player].find(
    (c) => c.definitionId === id,
  )!;
  const command = legalTrumpCommands(observeMatch(state, player).round).find(
    (c) =>
      c.instanceId === card.instanceId &&
      (targetId === undefined || c.targetId === targetId),
  );
  if (!command) throw new Error("Missing legal trump command: " + id);
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  ).state;
}
function finish(original: MatchState, random: Random) {
  let state = original,
    result: MatchTransition | undefined;
  for (let n = 0; state.phase === "playing"; n++) {
    if (n > 12) throw new Error("Unexpected quiet-Stay loop");
    result = act(state, "Stay", random);
    state = result.state;
  }
  return result!;
}
const next = (state: MatchState, random: Random) =>
  transitionMatch(
    state,
    { type: "NextRound", roundNumber: state.roundNumber },
    random,
  );
const skillEvents = (result: MatchTransition) =>
  result.events.flatMap((e) =>
    e.type === "round" && e.event.type === "skill" ? [e.event] : [],
  );
function reject(
  state: MatchState,
  random: Random,
  skillId: SkillId = "scapegoat",
) {
  const calls = random.skillEffects.mock.calls.length;
  const result = transitionMatch(
    state,
    {
      type: "ActivateSkill",
      player: state.round.turn!.player,
      skillId,
      turnNumber: state.round.turn!.number,
      roundNumber: state.roundNumber,
    },
    random,
  );
  expect(result).toEqual({ state, events: [] });
  expect(result.state).toBe(state);
  expect(random.skillEffects).toHaveBeenCalledTimes(calls);
}

describe("public settlement point skills", () => {
  it.each([
    ["tempt-fate", "human", 0, 1],
    ["tempt-fate", "human", 0.999999, 9],
    ["tempt-fate", "ai", 0, 1],
    ["tempt-fate", "ai", 0.999999, 11],
    ["frame", "human", 0, 1],
    ["frame", "human", 0.999999, 11],
    ["frame", "ai", 0, 1],
    ["frame", "ai", 0.999999, 9],
  ] as const)(
    "%s by %s samples %s only at settlement, amount=%s",
    (id, player, sample, amount) => {
      let { state, random } = fixture({
        human: player === "human" ? id : "spirit-sight",
        ai: player === "ai" ? id : "spirit-sight",
        samples: [sample],
      });
      if (player === "ai") state = act(state, "Stay", random).state;
      const before = state,
        prepared = skill(state, random);
      state = prepared.state;
      expect(state.round.skills!.players[player].activations[0].status).toBe(
        "prepared",
      );
      expect(state.round.skills!.players[player].remainingUses).toBe(
        before.round.skills!.players[player].remainingUses - 1,
      );
      expect(state.round.turn).toEqual({
        ...before.round.turn!,
        usedSkill: true,
      });
      expect(state.round.quietStays).toBe(0);
      expect(random.skillEffects).not.toHaveBeenCalled();
      reject(state, random, id);
      const result = finish(state, random);
      const target =
        id === "frame" ? (player === "human" ? "ai" : "human") : player;
      const totals = { human: 21, ai: 17 };
      totals[target] += amount;
      expect(result.state.round.result!.totals).toEqual(totals);
      expect(skillEvents(result).find((e) => e.skillId === id)).toMatchObject({
        status: "succeeded",
        amount,
      });
      const calls = random.skillEffects.mock.calls.length;
      projectMatchTransition(result, "human");
      projectMatchTransition(result, "ai");
      expect(random.skillEffects).toHaveBeenCalledTimes(calls);
      expect(random.skillSelection).not.toHaveBeenCalled();
      expect(random.trumpGate).not.toHaveBeenCalled();
      expect(random.trumpSelection).not.toHaveBeenCalled();
      expect(
        transitionMatch(
          result.state,
          { type: "Stay", player, roundNumber: result.state.roundNumber },
          random,
        ).state,
      ).toBe(result.state);
    },
  );
  it.each([
    ["tempt-fate", [8, 7, 9, 11]],
    ["frame", [8, 6, 9, 10]],
  ] as const)("%s does not override first player on a tie", (id, prefix) => {
    const f = fixture({ human: id, prefix, samples: [0] });
    const result = finish(skill(f.state, f.random).state, f.random);
    expect(result.state.round.result!.winner).toBeNull();
    expect(result.state.game.points).toEqual({ human: 0, ai: 0 });
    expect(result.state.nextFirstPlayer).toBeUndefined();
    expect(
      result.events.some((e) => e.type === "first-player-overridden"),
    ).toBe(false);
  });
  it.each([
    ["tempt-fate", [9, 8, 11, 7]],
    ["frame", [1, 8, 2, 9]],
  ] as const)(
    "%s does not override when its conditional result is absent",
    (id, prefix) => {
      const f = fixture({ human: id, prefix, samples: [0] });
      const result = finish(skill(f.state, f.random).state, f.random);
      expect(result.state.round.result!.winner).toBe(
        id === "tempt-fate" ? "human" : "ai",
      );
      expect(result.state.nextFirstPlayer).toBeUndefined();
    },
  );
});

describe("Scapegoat public legality and captured value", () => {
  it("rejects a true but publicly unconfirmed bust and ignores privately learned totals", () => {
    let { state, random } = fixture({
      human: "scapegoat",
      prefix: [8, 11, 9, 7],
      aiTrumps: ["gen-six"],
    });
    state = act(state, "Stay", random).state;
    state = play(state, "gen-six", random);
    state = act(state, "Stay", random).state;
    expect(effectiveTotals(state.round).ai).toBe(24);
    const view = observeMatch(state, "human").round;
    expect(view.hands.ai.total).toBeNull();
    expect(legalSkillCommands(view)).toEqual([]);
    const privateView: RoundObservation = {
      ...view,
      hands: {
        ...view.hands,
        ai: {
          ...view.hands.ai,
          total: 24,
          cards: view.hands.ai.cards.map((c, i) =>
            i === 0 ? { ...c, value: 11 } : c,
          ),
        },
      },
    };
    expect(legalSkillCommands(privateView)).toEqual([]);
    reject(state, random);
  });
  it("uses a guaranteed hidden minimum to confirm bust, transfers the original bound card and snapshots raw v", () => {
    let { state, random } = fixture({
      human: "scapegoat",
      prefix: [8, 2, 9, 11],
      humanTrumps: ["face-burden", "return"],
      aiTrumps: ["gen-ten"],
      samples: [0.999999],
    });
    state = act(state, "Stay", random).state;
    state = play(state, "gen-ten", random);
    state = act(state, "Stay", random).state;
    expect(observeMatch(state, "human").round.hands.ai.visibleTotal).toBe(21);
    expect(legalSkillCommands(observeMatch(state, "human").round)).toHaveLength(
      1,
    );
    const card = state.round.hands.ai.at(-1)!;
    state = play(state, "face-burden", random, card.instanceId);
    const hidden = state.round.hiddenCards,
      deck = state.round.deck;
    const prepared = skill(state, random);
    state = prepared.state;
    expect(state.round.hands.human.at(-1)).toBe(card);
    expect(state.round.hiddenCards).toBe(hidden);
    expect(state.round.deck).toBe(deck);
    expect(state.round.hands.ai[0].instanceId).toBe(hidden.ai);
    expect(state.round.skills!.players.human.activations[0]).toMatchObject({
      status: "prepared",
      effect: { type: "scapegoat", value: 10 },
    });
    expect(random.skillEffects).not.toHaveBeenCalled();
    state = play(state, "return", random);
    const result = finish(state, random);
    expect(result.state.round.result!.totals).toEqual({ human: 6, ai: 13 });
    expect(skillEvents(result)[0].amount).toBe(-11);
  });
  it("accepts a publicly revealed bust", () => {
    let { state, random } = fixture({
      human: "scapegoat",
      prefix: [8, 11, 9, 7],
      humanTrumps: ["reveal-opponent"],
      aiTrumps: ["gen-six"],
      samples: [0],
    });
    state = act(state, "Stay", random).state;
    state = play(state, "gen-six", random);
    state = act(state, "Stay", random).state;
    state = play(state, "reveal-opponent", random);
    expect(legalSkillCommands(observeMatch(state, "human").round)).toHaveLength(
      1,
    );
    const result = finish(skill(state, random).state, random);
    expect(skillEvents(result)[0].amount).toBe(-1);
  });
  it("rejects a publicly confirmed bust when the opponent has only their logical hidden card", () => {
    let { state, random } = fixture({
      human: "scapegoat",
      prefix: [8, 11, 9, 10],
      humanTrumps: ["double-hidden", "reveal-opponent"],
      aiTrumps: ["return"],
    });
    state = act(state, "Stay", random).state;
    state = play(state, "return", random);
    state = act(state, "Stay", random).state;
    state = play(state, "double-hidden", random);
    state = play(state, "reveal-opponent", random);
    const view = observeMatch(state, "human").round;
    expect(view.hands.ai.total).toBe(22);
    expect(view.faceUpCardIds.ai).toEqual([]);
    expect(legalSkillCommands(view)).toEqual([]);
    reject(state, random);
  });
  it("uses the moved original value for an AI Scapegoat even if Metamorphosis later changes that instance", () => {
    let { state, random } = fixture({
      human: "metamorphosis",
      ai: "scapegoat",
      prefix: [8, 2, 11, 9],
      humanTrumps: ["gen-ten", "gen-one"],
      samples: [0.999999, 0.999999],
    });
    state = play(state, "gen-ten", random);
    state = play(state, "gen-one", random);
    const original = state.round.hands.human.at(-1)!;
    state = skill(state, random).state;
    state = act(state, "Stay", random).state;
    const prepared = skill(state, random);
    state = prepared.state;
    expect(state.round.hands.ai.at(-1)).toBe(original);
    expect(state.round.skills!.players.ai.activations[0]).toMatchObject({
      effect: { type: "scapegoat", value: 1 },
      status: "prepared",
    });
    const result = finish(state, random);
    expect(skillEvents(result).map((e) => [e.skillId, e.amount])).toEqual([
      ["metamorphosis", undefined],
      ["scapegoat", -2],
    ]);
    expect(
      observeMatch(result.state, "ai").round.hands.ai.cards.at(-1)!.value,
    ).toBe(11);
    expect(result.state.round.result!.totals).toEqual({ human: 29, ai: 20 });
    expect(result.state.round.result!.winner).toBe("ai");
    expect(result.state.round.hands.ai.at(-1)).toBe(original);
    expect(random.skillEffects).toHaveBeenCalledTimes(2);
  });
  it("clamps only the final combined total, after a negative adjustment followed by Frame", () => {
    let { state, random } = fixture({
      human: "scapegoat",
      ai: "frame",
      prefix: [1, 3, 2, 10],
      humanTrumps: ["return"],
      aiTrumps: ["gen-eleven"],
      samples: [0.999999, 0.999999],
    });
    state = act(state, "Stay", random).state;
    state = play(state, "gen-eleven", random);
    state = act(state, "Stay", random).state;
    state = skill(state, random).state;
    state = play(state, "return", random);
    state = act(state, "Stay", random).state;
    state = skill(state, random).state;
    const result = finish(state, random);
    expect(skillEvents(result).map((e) => e.amount)).toEqual([-12, 4]);
    expect(result.state.round.result!.totals).toEqual({ human: 0, ai: 13 });
    expect(observeMatch(result.state, "human").round.hands.human.total).toBe(0);
    expect(
      observeMatch(result.state, "human").round.hands.human.visibleTotal,
    ).toBe(0);
  });
});

describe("secret Metamorphosis and ordered settlement", () => {
  it("prepares secretly with identical opposing observation/events/quiet state, then reveals at the normal two quiet Stays", () => {
    const { state, random } = fixture({
      human: "metamorphosis",
      prefix: [1, 8, 9, 2],
      samples: [0],
    });
    const before = observeMatch(state, "ai"),
      prepared = skill(state, random);
    expect(observeMatch(prepared.state, "ai")).toEqual(before);
    expect(projectMatchTransition(prepared, "ai")).toEqual({
      state: before,
      events: [],
    });
    expect(prepared.state.round.turn).toBe(state.round.turn);
    expect(prepared.state.round.quietStays).toBe(state.round.quietStays);
    expect(prepared.state.round.skills!.players.human).toMatchObject({
      remainingUses: 1,
      publicRemainingUses: 2,
      gameActivationsRemaining: 0,
    });
    expect(
      observeMatch(prepared.state, "human").round.skills!.human.activations[0],
    ).toMatchObject({ status: "prepared", effect: { type: "metamorphosis" } });
    expect(random.skillEffects).not.toHaveBeenCalled();
    const first = act(prepared.state, "Stay", random);
    expect(first.state.round.quietStays).toBe(1);
    const result = act(first.state, "Stay", random);
    expect(result.state.phase).toBe("round-complete");
    expect(result.state.round.hands).toBe(state.round.hands);
    expect(result.state.round.deck).toBe(state.round.deck);
    expect(result.state.round.hiddenCards).toBe(state.round.hiddenCards);
    expect(
      projectMatchTransition(result, "ai").state.round.hands.human.cards[0],
    ).toEqual({ value: 2, faceDown: false });
    expect(
      projectMatchTransition(result, "ai").state.round.skills!.human,
    ).toMatchObject({
      remainingUses: null,
      knownRemainingUses: { min: 0, max: 1 },
      activations: [{ status: "succeeded" }],
    });
    expect(random.skillEffects).toHaveBeenCalledTimes(1);
    const events = result.events.map((e) =>
      e.type === "round" ? e.event.type : e.type,
    );
    expect(events.indexOf("skill")).toBeGreaterThan(
      events.lastIndexOf("reveal"),
    );
  });
  it("does not reset an existing quiet Stay, reveal hidden use through legal actions, or resample a duplicate", () => {
    let { state, random } = fixture({
      ai: "metamorphosis",
      prefix: [8, 1, 9, 2],
      samples: [0.999999],
    });
    state = act(state, "Stay", random).state;
    const before = observeMatch(state, "human"),
      command = legalSkillCommands(observeMatch(state, "ai").round)[0];
    const prepared = skill(state, random);
    expect(observeMatch(prepared.state, "human")).toEqual(before);
    expect(prepared.state.round.quietStays).toBe(1);
    const duplicate = transitionMatch(
      prepared.state,
      { ...command, roundNumber: 1 },
      random,
    );
    expect(duplicate.state).toBe(prepared.state);
    expect(duplicate.events).toEqual([]);
    const result = act(prepared.state, "Stay", random);
    expect(result.state.round.result).not.toBeNull();
    expect(
      projectMatchTransition(result, "human").state.round.hands.ai.cards[0]
        .value,
    ).toBe(11);
    expect(random.skillEffects).toHaveBeenCalledTimes(1);
  });
  it("distinguishes legal no-effect resolution and spends without randomness", () => {
    const { state, random } = fixture({ human: "metamorphosis" });
    const result = finish(skill(state, random).state, random);
    expect(skillEvents(result)[0]).toMatchObject({ status: "ineffective" });
    expect(result.state.round.skills!.players.human.remainingUses).toBe(1);
    expect(
      observeMatch(result.state, "ai").round.skills!.human.knownRemainingUses
        .max,
    ).toBe(1);
    expect(random.skillEffects).not.toHaveBeenCalled();
  });
  it("transforms each generated 1 independently, preserves IDs/hidden index, and the second Metamorphosis does not reroll", () => {
    let { state, random } = fixture({
      human: "metamorphosis",
      ai: "metamorphosis",
      prefix: [1, 7, 8, 2],
      humanTrumps: ["gen-one", "gen-one", "resonance"],
      aiTrumps: ["face-burden"],
      samples: [0, 0.1, 0.999999],
    });
    state = play(state, "gen-one", random);
    state = play(state, "gen-one", random);
    state = play(state, "resonance", random);
    const raw = state.round.hands,
      hidden = state.round.hiddenCards,
      deck = state.round.deck;
    state = skill(state, random).state;
    state = act(state, "Stay", random).state;
    state = play(state, "face-burden", random, raw.human[2].instanceId);
    state = skill(state, random).state;
    const result = finish(state, random),
      view = observeMatch(result.state, "human");
    expect(view.round.hands.human.cards.map((c) => c.value)).toEqual([
      2, 8, 3, 11,
    ]);
    expect(result.state.round.result!.totals.human).toBe(26);
    expect(result.state.round.result!.pointTarget).toBe(25);
    expect(result.state.round.hands).toBe(raw);
    expect(result.state.round.hiddenCards).toBe(hidden);
    expect(result.state.round.deck).toBe(deck);
    expect(result.state.round.hands.human[0].instanceId).toBe(hidden.human);
    expect(view.round.faceUpCardIds.human).toEqual(
      raw.human.slice(1).map((c) => c.instanceId),
    );
    expect(skillEvents(result).map((e) => e.status)).toEqual([
      "succeeded",
      "ineffective",
    ]);
    expect(random.skillEffects).toHaveBeenCalledTimes(3);
  });
  it("resolves the earlier AI Metamorphosis first and clears settlement maps at the next Round", () => {
    let { state, random, addRound } = fixture({
      human: "metamorphosis",
      ai: "metamorphosis",
      prefix: [1, 7, 8, 2],
      aiTrumps: ["gen-one"],
      samples: [0, 0.999999],
    });
    state = act(state, "Stay", random).state;
    state = skill(state, random).state;
    state = play(state, "gen-one", random);
    state = act(state, "Stay", random).state;
    state = skill(state, random).state;
    const result = finish(state, random);
    expect(skillEvents(result).map((e) => [e.player, e.status])).toEqual([
      ["ai", "succeeded"],
      ["human", "ineffective"],
    ]);
    expect(
      observeMatch(result.state, "human").round.hands.human.cards[0].value,
    ).toBe(2);
    expect(
      observeMatch(result.state, "human").round.hands.ai.cards.at(-1)!.value,
    ).toBe(11);
    addRound([1, 7, 8, 2]);
    state = next(result.state, random).state;
    expect(state.round.settlementValues).toBeUndefined();
    expect(state.round.settlementTotals).toBeUndefined();
    expect(state.round.hands.ai[0].value).toBe(1);
    expect(state.round.skills!.players.human).toMatchObject({
      remainingUses: 1,
      publicRemainingUses: 1,
      gameActivationsRemaining: 0,
    });
    expect(state.round.skills!.players.ai).toMatchObject({
      remainingUses: 1,
      publicRemainingUses: 1,
      gameActivationsRemaining: 0,
    });
    expect(random.skillEffects).toHaveBeenCalledTimes(2);
    expect(random.numbers).toHaveBeenCalledTimes(21);
  });
  it("keeps trim based on original face-up instances before settlement, and never transforms a returned deck card", () => {
    let { state, random } = fixture({
      human: "metamorphosis",
      prefix: [1, 7, 8, 2],
      humanTrumps: ["trim", "gen-one"],
      samples: [0, 0.999999],
    });
    state = play(state, "gen-one", random);
    const hidden = state.round.hands.human[0];
    state = skill(state, random).state;
    state = play(state, "trim", random);
    expect(state.round.hands.human[0]).toBe(hidden);
    expect(state.round.hands.human.map((c) => c.value)).toEqual([1, 1]);
    const deck = state.round.deck,
      result = finish(state, random);
    expect(result.state.round.deck).toBe(deck);
    expect(result.state.round.settlementValues).toEqual({
      [hidden.instanceId]: 2,
      [state.round.hands.human[1].instanceId]: 11,
    });
    expect(random.skillEffects).toHaveBeenCalledTimes(2);
  });
  it("runs Metamorphosis before hidden multipliers/symbiosis and uses the pre-symbiosis opposing hidden value for Invite Misfortune", () => {
    let { state, random } = fixture({
      human: "tempt-fate",
      ai: "metamorphosis",
      prefix: [8, 1, 9, 2],
      aiTrumps: ["double-self", "symbiosis"],
      samples: [0.5, 0.999999],
    });
    state = skill(state, random).state;
    state = act(state, "Stay", random).state;
    state = play(state, "double-self", random);
    state = play(state, "symbiosis", random);
    state = skill(state, random).state;
    const result = finish(state, random);
    expect(skillEvents(result).map((e) => [e.skillId, e.amount])).toEqual([
      ["metamorphosis", undefined],
      ["tempt-fate", 15],
    ]);
    expect(result.state.round.result!.totals).toEqual({ human: 46, ai: 24 });
    expect(result.state.round.result!.winner).toBe("ai");
    expect(result.state.nextFirstPlayer).toBe("human");
    expect(random.skillEffects).toHaveBeenCalledTimes(2);
  });
  it("uses Frame's caster hidden value before symbiosis and awards trumps' points using the modified winner", () => {
    let { state, random } = fixture({
      human: "metamorphosis",
      ai: "frame",
      prefix: [1, 8, 9, 2],
      humanTrumps: ["double-self", "symbiosis"],
      aiTrumps: ["pressure"],
      samples: [0.999999, 0.999999],
    });
    state = play(state, "double-self", random);
    state = play(state, "symbiosis", random);
    state = skill(state, random).state;
    state = act(state, "Stay", random).state;
    state = play(state, "pressure", random);
    state = skill(state, random).state;
    const result = finish(state, random);
    expect(skillEvents(result).map((e) => e.amount)).toEqual([undefined, 9]);
    expect(result.state.round.result!.totals).toEqual({ human: 48, ai: 32 });
    expect(result.state.round.result!.winner).toBe("ai");
    expect(result.state.game.points).toEqual({ human: 0, ai: 2 });
    expect(result.events.find((e) => e.type === "round-scored")).toMatchObject({
      type: "round-scored",
      score: { base: 1, attack: 1, increment: 2 },
    });
  });
});

describe("one-shot first-player override and Match boundaries", () => {
  it("combines both qualifying skills into one loser override, consumes it, then alternates from the overridden first player", () => {
    let { state, random, addRound } = fixture({
      human: "tempt-fate",
      ai: "frame",
      prefix: [8, 10, 9, 11],
      samples: [0, 0],
    });
    state = skill(state, random).state;
    state = act(state, "Stay", random).state;
    state = skill(state, random).state;
    const result = finish(state, random);
    expect(result.state.round.result!.winner).toBe("ai");
    expect(
      result.events.filter((e) => e.type === "first-player-overridden"),
    ).toHaveLength(1);
    expect(projectMatchTransition(result, "human").state.nextFirstPlayer).toBe(
      "human",
    );
    expect(
      result.events.findIndex((e) => e.type === "first-player-overridden"),
    ).toBeLessThan(result.events.findIndex((e) => e.type === "round-cleanup"));
    addRound([8, 10, 9, 11]);
    state = next(result.state, random).state;
    expect(state.round.firstPlayer).toBe("human");
    expect(state.nextFirstPlayer).toBeUndefined();
    const ordinary = finish(state, random);
    expect(ordinary.state.nextFirstPlayer).toBeUndefined();
    addRound([10, 8, 11, 9]);
    state = next(ordinary.state, random).state;
    expect(state.round.firstPlayer).toBe("ai");
    expect(random.numbers).toHaveBeenCalledTimes(31);
  });
  it("carries overrides across sudden-death Game wins and creates no next first-player state at Match completion", () => {
    let { state, random, addRound } = fixture({
      human: "tempt-fate",
      ai: "frame",
      prefix: [8, 10, 9, 11],
      humanTrumps: ["sudden-death"],
      samples: [0, 0, 0, 0],
    });
    const rules = state.rules;
    for (let game = 1; game <= 3; game++) {
      state = play(state, "sudden-death", random);
      state = skill(state, random).state;
      if (game === 1) {
        state = act(state, "Stay", random).state;
        state = skill(state, random).state;
      }
      const result = finish(state, random);
      state = result.state;
      expect(state.game.winner).toBe("ai");
      expect(state.wins.ai).toBe(game);
      expect(result.events.filter((e) => e.type === "game-won")).toHaveLength(
        1,
      );
      expect(
        result.events.filter((e) => e.type === "round-scored"),
      ).toHaveLength(1);
      if (game < 3) {
        expect(state.phase).toBe("game-complete");
        expect(state.nextFirstPlayer).toBe("human");
        addRound([8, 10, 9, 11]);
        state = next(state, random).state;
        expect(state.round.firstPlayer).toBe("human");
        expect(state.nextFirstPlayer).toBeUndefined();
        expect(state.rules).toBe(rules);
        expect(state.round.skills!.players.human.gameActivationsRemaining).toBe(
          1,
        );
      } else {
        expect(state.phase).toBe("complete");
        expect(state.nextFirstPlayer).toBeUndefined();
        expect(
          result.events.filter((e) => e.type === "first-player-overridden"),
        ).toEqual([]);
        expect(
          result.events.filter((e) => e.type === "match-won"),
        ).toHaveLength(1);
        expect(next(state, random)).toEqual({ state, events: [] });
      }
    }
    expect(random.numbers).toHaveBeenCalledTimes(31);
    expect(random.skillEffects).toHaveBeenCalledTimes(4);
  });
});
