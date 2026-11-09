// @req REQ-2026-027: actual commands prove private authorization, spending and lifecycle.
import { describe, expect, it, vi } from "vitest";
import {
  DIFFICULTIES,
  type Difficulty,
  type NumberValue,
  type PlayerId,
} from "../types";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  projectMatchTransition,
  legalMatchActions,
  legalSkillCommands,
} from "./index";
import type {
  ActivateSkillCommand,
  ContestRandom,
  ContestRandomSources,
  MatchState,
  MatchCommand,
  RoundRules,
  SkillRules,
} from "./index";
import { fixedRandom } from "./testHelpers";
import { S2_DEVELOPMENT_PRESET } from "../presets/s2";
import { opponentOf } from "./turn";

function rules(difficulty: Difficulty = "standard"): RoundRules {
  return {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty,
      playableDifficulties: [...DIFFICULTIES],
      selected: { human: "spirit-sight", ai: "spirit-sight" },
    },
  };
}
function sources(
  prefix: readonly NumberValue[] = [10, 8, 11, 9],
  rounds = 1,
): Required<ContestRandomSources> {
  const samples = [0.25];
  for (let n = 0; n < rounds; n++) {
    const first = n % 2 === 0 ? "human" : "ai";
    const order =
      first === "human" ? prefix : [prefix[1], prefix[0], prefix[3], prefix[2]];
    const shuffle = fixedRandom(order);
    for (let i = 0; i < 10; i++) samples.push(shuffle());
  }
  let i = 0;
  const unexpected = () => {
    throw new Error("Unexpected random consumption");
  };
  return {
    numbers: vi.fn(() => (i < samples.length ? samples[i++] : unexpected())),
    trumpGate: vi.fn(unexpected),
    trumpSelection: vi.fn(unexpected),
    skillSelection: vi.fn(unexpected),
    skillEffects: vi.fn(unexpected),
  };
}
function act(state: MatchState, type: "Hit" | "Stay", random: ContestRandom) {
  return transitionMatch(
    state,
    { type, player: state.round.turn!.player, roundNumber: state.roundNumber },
    random,
  );
}
function finish(state: MatchState, random: ContestRandom) {
  let n = 0;
  while (state.phase === "playing") {
    if (++n > 10) throw new Error("Unexpected round loop");
    state = act(state, "Stay", random).state;
  }
  return state;
}
function activate(state: MatchState, player: PlayerId, random: ContestRandom) {
  const command = legalSkillCommands(observeMatch(state, player).round)[0];
  if (!command) throw new Error("No legal skill command");
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
}
const next = (state: MatchState, random: ContestRandom) =>
  transitionMatch(
    state,
    { type: "NextRound", roundNumber: state.roundNumber },
    random,
  );
// publicRemainingUses is an explicitly authorized upper bound since REQ-028;
// the private counters, hidden knowledge and activation ordering remain excluded.
function assertNoPrivateStructures(value: unknown) {
  if (value && typeof value === "object") {
    for (const key of [
      "deck",
      "knownHiddenCards",
      "nextActivationSequence",
      "sequence",
      "public",
    ])
      expect(Object.keys(value)).not.toContain(key);
    for (const child of Object.values(value)) assertNoPrivateStructures(child);
  }
}

describe("skill setup and frozen configuration", () => {
  it.each(DIFFICULTIES)(
    "initializes the exact Spirit Sight allowance for %s",
    (d) => {
      const state = createMatch(sources(), rules(d)).state;
      const expected = [1, 2, 2, 3, 4][DIFFICULTIES.indexOf(d)];
      for (const player of ["human", "ai"] as const) {
        expect(state.round.skills!.players[player]).toEqual({
          remainingUses: expected,
          publicRemainingUses: expected,
          gameActivationsRemaining: 1,
          activations: [],
        });
        expect(
          observeMatch(state, player).round.skills![opponentOf(player)],
        ).toMatchObject({
          id: "spirit-sight",
          initialUses: expected,
          remainingUses: expected,
        });
      }
    },
  );
  it("copies and freezes caller configuration throughout Match events", () => {
    const input = rules(),
      random = sources(undefined, 2);
    const initial = createMatch(random, input);
    (input.skills!.selected as { human: string }).human = "pickpocket";
    (input.skills!.playableDifficulties as Difficulty[]).splice(0);
    const finished = finish(initial.state, random),
      continued = next(finished, random);
    expect(initial.state.rules.round.skills!.selected.human).toBe(
      "spirit-sight",
    );
    expect(continued.state.rules).toBe(initial.state.rules);
    for (const event of [...initial.events, ...continued.events])
      expect(event.state.round.rules).toBe(initial.state.rules.round);
    expect(Object.isFrozen(initial.state.rules.round.skills!.selected)).toBe(
      true,
    );
    expect(Object.isFrozen(initial.state.round.skills!.players.human)).toBe(
      true,
    );
  });
  it("rejects locked, unknown, missing and zero-use selections before randomness", () => {
    const bad: SkillRules[] = [
      {
        difficulty: "standard",
        playableDifficulties: [],
        selected: { human: "spirit-sight", ai: "spirit-sight" },
      },
      {
        ...rules().skills!,
        selected: { human: "unknown" as never, ai: "spirit-sight" },
      },
      {
        ...rules("danger").skills!,
        selected: { human: "endless-life", ai: "spirit-sight" },
      },
      {
        ...rules().skills!,
        selected: { human: "spirit-sight", ai: undefined as never },
      },
    ];
    for (const skills of bad) {
      const random = sources();
      expect(() => createMatch(random, { ...rules(), skills })).toThrow(
        RangeError,
      );
      for (const stream of Object.values(random))
        expect(stream).not.toHaveBeenCalled();
    }
  });
  it("rejects skill/resource difficulty disagreement before any random stream advances", () => {
    const random = sources();
    expect(() =>
      createMatch(random, {
        ...S2_DEVELOPMENT_PRESET.round,
        skills: rules("nightmare").skills,
      }),
    ).toThrow(RangeError);
    for (const stream of Object.values(random))
      expect(stream).not.toHaveBeenCalled();
  });
  it("requires independent skill ports before dealing, while legacy no-skill matches still accept a function", () => {
    const random = vi.fn(() => 0.5);
    expect(() => createMatch(random, rules())).toThrow(RangeError);
    expect(random).not.toHaveBeenCalled();
    const ports = sources();
    const { skillEffects: _effects, ...missing } = ports;
    expect(() => createMatch(missing, rules())).toThrow(RangeError);
    expect(ports.numbers).not.toHaveBeenCalled();
    expect(createMatch(random).state.round.skills).toBeUndefined();
  });
});

describe("Spirit Sight execution and authorized information", () => {
  it.each(["human", "ai"] as const)(
    "lets %s see the logical hidden value without a public reveal or changing targets",
    (player) => {
      const random = sources();
      let original = createMatch(random, rules()).state;
      if (player === "ai") original = act(original, "Hit", random).state;
      const before = observeMatch(original, player),
        target = opponentOf(player);
      const result = activate(original, player, random),
        state = result.state;
      const view = projectMatchTransition(result, player),
        other = projectMatchTransition(result, target);
      const hidden = state.round.hands[target].find(
        (c) => c.instanceId === state.round.hiddenCards[target],
      )!;
      expect(before.round.hands[target].cards[0].value).toBeNull();
      expect(view.state.round.hands[target].cards[0]).toEqual({
        value: hidden.value,
        faceDown: true,
      });
      expect(other.state.round.hands[player].cards[0].value).toBeNull();
      expect(other.state.round.hands[target].cards[0].faceDown).toBe(true);
      expect(view.state.round.hands[target].total).not.toBeNull();
      expect(state.round.revealed).toEqual(original.round.revealed);
      expect(state.round.hiddenCards).toBe(original.round.hiddenCards);
      expect(view.state.round.faceUpCardIds).toEqual(
        before.round.faceUpCardIds,
      );
      expect(state.round.turn).toEqual({
        ...original.round.turn!,
        usedSkill: true,
      });
      expect(state.round.turn!.usedTrump).toBe(false);
      expect(state.round.quietStays).toBe(0);
      expect(state.round.hands).toBe(original.round.hands);
      expect(state.round.deck).toBe(original.round.deck);
      expect(state.round.skills!.players[player]).toMatchObject({
        remainingUses: 1,
        gameActivationsRemaining: 0,
        activations: [
          {
            status: "succeeded",
            roundNumber: 1,
            turnNumber: original.round.turn!.number,
          },
        ],
      });
      expect(result.events).toHaveLength(2);
      expect(
        result.events.map((e) => e.type === "round" && e.event.type),
      ).toEqual(["skill", "skill"]);
      expect(
        view.events[0].state.round.hands[target].cards[0].value,
      ).toBeNull();
      expect(view.events[0].state.round.skills![player].remainingUses).toBe(1);
      for (const projected of [view, other]) {
        assertNoPrivateStructures(projected);
        for (const e of projected.events)
          if (e.type === "round" && e.event.type === "skill") {
            expect(Object.keys(e.event).sort()).toEqual([
              "player",
              "skillId",
              "state",
              "status",
              "type",
            ]);
          }
      }
      expect(random.numbers).toHaveBeenCalledTimes(11);
      for (const key of [
        "skillSelection",
        "skillEffects",
        "trumpGate",
        "trumpSelection",
      ] as const)
        expect(random[key]).not.toHaveBeenCalled();
      // Replay/projection is pure and never resamples.
      expect(projectMatchTransition(result, player)).toEqual(view);
      expect(random.skillEffects).not.toHaveBeenCalled();
    },
  );
  it("keeps unauthorized worlds identical, including all event frames and legal actions", () => {
    const a = sources([10, 8, 11, 9]),
      b = sources([5, 8, 11, 9]);
    const left = activate(createMatch(a, rules()).state, "human", a);
    const right = activate(createMatch(b, rules()).state, "human", b);
    expect(projectMatchTransition(left, "ai")).toEqual(
      projectMatchTransition(right, "ai"),
    );
    expect(legalMatchActions(observeMatch(left.state, "ai"))).toEqual(
      legalMatchActions(observeMatch(right.state, "ai")),
    );
  });
  it("rejects duplicate, wrong actor, wrong identity, stale Turn and stale Round commands with no side effects", () => {
    const random = sources(),
      initial = createMatch(random, rules()).state;
    const originalCommand = {
      ...legalSkillCommands(observeMatch(initial, "human").round)[0],
      roundNumber: 1,
    };
    const assertRejected = (state: MatchState, command: MatchCommand) => {
      const result = transitionMatch(state, command, random);
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
      expect(random.numbers).toHaveBeenCalledTimes(11);
      expect(random.skillEffects).not.toHaveBeenCalled();
      expect(random.skillSelection).not.toHaveBeenCalled();
    };
    assertRejected(initial, { ...originalCommand, player: "ai" });
    assertRejected(initial, { ...originalCommand, skillId: "fortune" });
    assertRejected(initial, {
      ...originalCommand,
      skillId: "unknown" as never,
    });
    assertRejected(initial, { ...originalCommand, roundNumber: 0 });
    const accepted = transitionMatch(initial, originalCommand, random).state;
    assertRejected(accepted, originalCommand);
    let state = act(initial, "Hit", random).state;
    assertRejected(state, originalCommand);
    state = act(state, "Hit", random).state;
    assertRejected(state, originalCommand);
    expect(legalSkillCommands(observeMatch(state, "human").round)).toHaveLength(
      1,
    );
    expect(activate(state, "human", random).state).not.toBe(state);
  });
  it("allows a later Turn after Stay, interrupts quiet Stay, and preserves private knowledge until Round cleanup", () => {
    const random = sources(undefined, 2),
      initial = createMatch(random, rules()).state;
    const old = legalSkillCommands(observeMatch(initial, "human").round)[0];
    let state = act(initial, "Stay", random).state;
    expect(state.round.quietStays).toBe(1);
    const endedTurn = transitionMatch(
      state,
      { ...old, roundNumber: 1 },
      random,
    );
    expect(endedTurn.state).toBe(state);
    expect(endedTurn.events).toEqual([]);
    expect(state.round.skills!.players.human.remainingUses).toBe(2);
    state = act(state, "Hit", random).state;
    expect(
      transitionMatch(state, { ...old, roundNumber: 1 }, random).state,
    ).toBe(state);
    state = activate(state, "human", random).state;
    const stayed = act(state, "Stay", random);
    expect(stayed.state.round.quietStays).toBe(0);
    expect(
      observeMatch(stayed.state, "human").round.hands.ai.cards[0].value,
    ).toBe(8);
    const done = finish(stayed.state, random);
    expect(done.round.skills!.knownHiddenCards).toEqual({
      human: null,
      ai: null,
    });
    const continued = next(done, random).state;
    expect(
      observeMatch(continued, "human").round.hands.ai.cards[0].value,
    ).toBeNull();
    expect(continued.round.skills!.players.human).toMatchObject({
      remainingUses: 1,
      gameActivationsRemaining: 0,
    });
    expect(legalSkillCommands(observeMatch(continued, "human").round)).toEqual(
      [],
    );
  });
  it("rejects an already publicly revealed opposing slot through actual PlayTrump", () => {
    const random = sources(),
      input = {
        ...rules(),
        trumps: {
          tableCapacity: 5 as const,
          definitions: {
            reveal: {
              onPlay: [
                { type: "reveal-hidden" as const, target: "opponent" as const },
              ],
            },
          },
        },
      };
    const initial = createMatch(random, input, {
      human: [{ instanceId: "reveal-h", definitionId: "reveal" }],
      ai: [],
    }).state;
    const command: ActivateSkillCommand = legalSkillCommands(
      observeMatch(initial, "human").round,
    )[0];
    const publicState = transitionMatch(
      initial,
      {
        type: "PlayTrump",
        player: "human",
        instanceId: "reveal-h",
        roundNumber: 1,
      },
      random,
    ).state;
    expect(publicState.round.revealed).toContain("ai");
    const result = transitionMatch(
      publicState,
      { ...command, roundNumber: 1 },
      random,
    );
    expect(result.state).toBe(publicState);
    expect(result.events).toEqual([]);
    expect(publicState.round.skills!.players.human.remainingUses).toBe(2);
    expect(
      legalSkillCommands(observeMatch(publicState, "human").round),
    ).toEqual([]);
    expect(random.skillEffects).not.toHaveBeenCalled();
  });
});

describe("Round/Game/Match skill lifecycle", () => {
  it("retains Match uses, resets only new Game permission and never replaces the frozen selection", () => {
    const random = sources(undefined, 15);
    let state = createMatch(random, rules()).state;
    const frozenRules = state.rules;
    for (let round = 1; round <= 15; round++) {
      if (round === 1 || round === 6) {
        if (state.round.turn!.player === "ai")
          state = act(state, "Stay", random).state;
        state = activate(state, "human", random).state;
      }
      if (round === 11) {
        expect(state.round.skills!.players.human).toEqual({
          remainingUses: 0,
          publicRemainingUses: 0,
          hasSucceeded: true,
          gameActivationsRemaining: 1,
          activations: [],
        });
        if (state.round.turn!.player === "ai")
          state = act(state, "Stay", random).state;
        expect(legalSkillCommands(observeMatch(state, "human").round)).toEqual(
          [],
        );
      }
      state = finish(state, random);
      if (round < 15) {
        const result = next(state, random);
        state = result.state;
        for (const event of result.events)
          expect(event.state.rules).toBe(frozenRules);
        if (round === 5) {
          expect(state.game.number).toBe(2);
          expect(state.round.skills!.players.human).toEqual({
            remainingUses: 1,
            publicRemainingUses: 1,
            hasSucceeded: true,
            gameActivationsRemaining: 1,
            activations: [],
          });
          expect(state.round.skills!.knownHiddenCards).toEqual({
            human: null,
            ai: null,
          });
          expect(state.round.skills!.nextActivationSequence).toBe(2);
        }
      }
      expect(state.rules).toBe(frozenRules);
    }
    expect(state.phase).toBe("complete");
    expect(state.winner).toBe("human");
    expect(random.numbers).toHaveBeenCalledTimes(151);
    const command = {
      type: "ActivateSkill" as const,
      skillId: "spirit-sight" as const,
      player: "human" as const,
      turnNumber: 1,
      roundNumber: 15,
    };
    expect(transitionMatch(state, command, random)).toEqual({
      state,
      events: [],
    });
    expect(random.skillEffects).not.toHaveBeenCalled();
  });
});
