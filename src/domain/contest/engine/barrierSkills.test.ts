// @req REQ-2026-027: inclusive seals, secrecy-independent cancellation and immune recurring generation through real commands.
import { describe, expect, it } from "vitest";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  projectMatchTransition,
  legalSkillCommands,
  legalTrumpCommands,
  isNullifyImmune,
} from "./index";
import type { MatchState, MatchCommand } from "./index";
import type { PlayerId } from "../types";
import {
  fixture,
  fixturePorts,
  pass,
  play,
  skill,
  act,
  finish,
  assertBarrierLedger,
} from "./skillBarrierTestHelpers";
import { beginTurn } from "./triggers";

const next = (f: ReturnType<typeof fixture>, state: MatchState) => {
  f.addRound();
  return transitionMatch(
    state,
    { type: "NextRound", roundNumber: state.roundNumber },
    f.random,
  );
};
describe("Dispel All Arts", () => {
  it.each(["human", "ai"] as const)(
    "lets %s seal both inventories and disable the other skill without clearing table records",
    (player) => {
      const f = fixture(
        player === "human"
          ? { humanTrumps: ["pressure", "scry"], aiTrumps: ["noop", "return"] }
          : {
              first: "ai",
              human: "spirit-sight",
              ai: "nullify",
              humanTrumps: ["noop", "return"],
              aiTrumps: ["pressure", "scry"],
            },
      );
      const before = play(f.state, "pressure", f.random).state;
      const result = skill(before, player, f.random),
        state = result.state;
      const other: PlayerId = player === "human" ? "ai" : "human";
      expect(state.round.skills!.seal).toEqual({ throughRound: 3 });
      expect(state.round.skills!.players[other].disabled).toBe(true);
      for (const viewer of [player, other] as const) {
        const projected = projectMatchTransition(result, viewer);
        for (const frame of [projected.events[0].state, projected.state]) {
          expect(frame.round.skills![player].effectActive).toBe(true);
          expect(frame.round.skills![other].disabled).toBe(true);
        }
        // The first public frame has the lock, while hand deletions still replay individually.
        expect(projected.events[0].state.round.trumps!.ownHand).toHaveLength(
          before.round.trumps!.hands[viewer].length,
        );
      }
      expect(state.round.skills!.players[player]).toMatchObject({
        remainingUses: 2,
        gameActivationsRemaining: 0,
        hasSucceeded: true,
      });
      expect(state.round.trumps!.hands).toEqual({ human: [], ai: [] });
      expect(state.round.trumps!.table).toBe(before.round.trumps!.table);
      expect(state.round.trumps!.stock).toBe(before.round.trumps!.stock);
      expect(state.round.hands).toBe(before.round.hands);
      expect(state.round.turn).toMatchObject({ player, usedSkill: true });
      expect(state.round.lastPlay).toBeNull();
      expect(state.round.quietStays).toBe(0);
      for (const event of projectMatchTransition(result, player).events)
        if (
          event.type === "round" &&
          event.event.type === "resource" &&
          event.event.player !== player
        )
          expect(event.event.instance).toBeNull();
      expect(f.calls).toEqual({
        numbers: 11,
        trumpGate: 0,
        trumpSelection: 0,
        skillEffects: 0,
        skillSelection: 0,
      });
      assertBarrierLedger(result);
    },
  );
  it("blocks Hit and Round-start supply through R+2, then releases supply while Game disable remains", () => {
    const f = fixture({
      stock: { noop: 10 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
      gates: [0],
    });
    let state = skill(f.state, "human", f.random).state;
    const stock = state.round.trumps!.stock;
    const hit = act(state, "Hit", f.random);
    expect(
      hit.events.some(
        (e) =>
          e.type === "round" &&
          e.event.type === "resource" &&
          e.event.operation === "blocked",
      ),
    ).toBe(true);
    expect(hit.state.round.trumps!.stock).toBe(stock);
    expect(f.calls.trumpSelection).toBe(6);
    state = finish(hit.state, f.random);
    for (let round = 2; round <= 3; round++) {
      const continued = next(f, state);
      state = continued.state;
      expect(state.round.trumps!.hands).toEqual({ human: [], ai: [] });
      expect(
        continued.events.filter(
          (e) =>
            e.type === "round" &&
            e.event.type === "resource" &&
            e.event.operation === "blocked",
        ),
      ).toHaveLength(2);
      expect(observeMatch(state, "human").round.skillSeal).toEqual({
        throughRound: 3,
      });
      expect(f.calls.trumpSelection).toBe(6);
      state = finish(state, f.random);
    }
    expect(state.round.skills!.seal).toBeUndefined();
    const released = next(f, state);
    expect(released.state.roundNumber).toBe(4);
    expect(released.state.round.trumps!.hands.human).toHaveLength(1);
    expect(released.state.round.trumps!.hands.ai).toHaveLength(1);
    expect(f.calls.trumpSelection).toBe(8);
    expect(
      observeMatch(released.state, "human").round.skills!.human.effectActive,
    ).toBe(true);
    expect(observeMatch(released.state, "ai").round.skills!.ai.disabled).toBe(
      true,
    );
    expect(
      legalSkillCommands(observeMatch(released.state, "ai").round),
    ).toEqual([]);
    assertBarrierLedger(released);
  });
  it("clears both public restrictions immediately when a sudden-death Game ends early", () => {
    const f = fixture({
      humanTrumps: ["sudden-death", "noop"],
      aiTrumps: ["noop"],
    });
    let state = play(f.state, "sudden-death", f.random).state;
    state = finish(skill(state, "human", f.random).state, f.random);
    expect(state.phase).toBe("game-complete");
    expect(state.round.skills!.seal).toBeUndefined();
    expect(state.round.skills!.players.ai.disabled).toBeUndefined();
    expect(
      observeMatch(state, "human").round.skills!.human.effectActive,
    ).toBeUndefined();
    const continued = next(f, state).state;
    expect(continued.game.number).toBe(2);
    expect(continued.round.skills!.players.human).toMatchObject({
      remainingUses: 2,
      gameActivationsRemaining: 1,
      hasSucceeded: true,
    });
    expect(
      legalSkillCommands(observeMatch(continued, "ai").round),
    ).toHaveLength(1);
    expect(continued.rules).toBe(state.rules);
  });
  it.each(["tempt-fate", "frame", "provoke"] as const)(
    "cancels the opposing public pending %s without refunding its use",
    (id) => {
      const f = fixture({ first: "ai", ai: id });
      const armed = skill(f.state, "ai", f.random).state;
      const started = act(armed, "Stay", f.random).state;
      const result = skill(started, "human", f.random);
      expect(result.state.round.skills!.players.ai.activations[0].status).toBe(
        "cancelled",
      );
      expect(result.state.round.skills!.players.ai.remainingUses).toBe(
        id === "tempt-fate" ? 4 : 3,
      );
      expect(
        result.state.round.skills!.players.ai.hasSucceeded,
      ).toBeUndefined();
      const finished = finish(result.state, f.random);
      expect(finished.round.result!.totals).toEqual({ human: 17, ai: 21 });
      expect(f.calls.skillEffects).toBe(0);
      expect(
        result.events.some(
          (e) =>
            e.type === "round" &&
            e.event.type === "skill" &&
            e.event.status === "cancelled",
        ),
      ).toBe(true);
    },
  );
  it("cancels Scapegoat's pending adjustment without reversing its already moved face", () => {
    const f = fixture({
      first: "ai",
      ai: "scapegoat",
      aiTrumps: Array<string>(6).fill("forced-draw"),
    });
    let state = f.state;
    for (let n = 0; n < 6; n++)
      state = play(state, "forced-draw", f.random).state;
    state = skill(state, "ai", f.random).state;
    const moved = state.round.hands.ai.at(-1)!;
    state = act(state, "Stay", f.random).state;
    state = skill(state, "human", f.random).state;
    expect(state.round.hands.ai).toContain(moved);
    expect(state.round.skills!.players.ai.activations[0].status).toBe(
      "cancelled",
    );
    expect(f.calls.skillEffects).toBe(0);
    assertBarrierLedger({ state, events: [] });
  });
  it("retains a successful Spirit Sight and its authorized knowledge", () => {
    const f = fixture({ first: "ai" });
    let state = skill(f.state, "ai", f.random).state;
    state = act(state, "Stay", f.random).state;
    const result = skill(state, "human", f.random);
    expect(result.state.round.skills!.players.ai.activations[0].status).toBe(
      "succeeded",
    );
    expect(
      observeMatch(result.state, "ai").round.hands.human.cards[0].value,
    ).toBe(8);
    expect(observeMatch(result.state, "ai").round.skills!.ai.canRecover).toBe(
      true,
    );
  });
  it.each(
    (["metamorphosis", "soul-transfer"] as const).flatMap((id) =>
      (["human", "ai"] as const).map((player) => ({ id, player })),
    ),
  )(
    "lets $player cancel secret $id without exposing its preparation",
    ({ id, player }) => {
      const other: PlayerId = player === "human" ? "ai" : "human";
      const options = {
        first: other,
        human: player === "human" ? ("nullify" as const) : id,
        ai: player === "ai" ? ("nullify" as const) : id,
        prefix: [1, 8, 11, 9] as const,
      };
      const a = fixture(options),
        b = fixture(options);
      const hidden = act(
        skill(a.state, other, a.random).state,
        "Stay",
        a.random,
      ).state;
      const plain = act(b.state, "Stay", b.random).state;
      const left = skill(hidden, player, a.random),
        right = skill(plain, player, b.random);
      expect(projectMatchTransition(left, player)).toEqual(
        projectMatchTransition(right, player),
      );
      expect(left.state.round.skills!.players[other]).toMatchObject({
        disabled: true,
        remainingUses: id === "metamorphosis" ? 4 : 2,
        gameActivationsRemaining: 0,
        activations: [{ public: false, status: "cancelled" }],
      });
      const owner = observeMatch(left.state, other).round.skills![other];
      expect(owner.activations[0].status).toBe("cancelled");
      expect(owner.canRecover).toBeUndefined();
      expect(
        observeMatch(left.state, player).round.skills![other].activations,
      ).toEqual([]);
      expect(
        projectMatchTransition(left, other).events.filter(
          (e) =>
            e.type === "round" &&
            e.event.type === "skill" &&
            e.event.skillId === id &&
            e.event.status === "cancelled",
        ),
      ).toHaveLength(1);
      const finished = finish(left.state, a.random),
        plainFinished = finish(right.state, b.random);
      expect(finished.round.skills!.players[other].activations[0].status).toBe(
        "cancelled",
      );
      expect(
        finished.round.skills!.players[other].hasSucceeded,
      ).toBeUndefined();
      expect(finished.round.result).toEqual(plainFinished.round.result);
      expect(a.calls.skillEffects).toBe(0);
      assertBarrierLedger(left);
    },
  );
  it.each(["human", "ai"] as const)(
    "lets %s cancel a secret Twin Bloom before it copies, closing new reactions",
    (player) => {
      const other: PlayerId = player === "human" ? "ai" : "human";
      const options = {
        first: player,
        human:
          player === "human" ? ("nullify" as const) : ("twin-bloom" as const),
        ai: player === "ai" ? ("nullify" as const) : ("twin-bloom" as const),
      };
      const f = fixture(options),
        plain = fixture(options);
      const prepared = skill(f.state, other, f.random).state;
      const sealed = skill(prepared, player, f.random),
        control = skill(plain.state, player, plain.random);
      expect(projectMatchTransition(sealed, player)).toEqual(
        projectMatchTransition(control, player),
      );
      expect(
        sealed.state.round.skills!.players[other].activations[0],
      ).toMatchObject({
        public: false,
        status: "cancelled",
      });
      expect(observeMatch(sealed.state, player).round.reaction).toBeUndefined();
      const continued = act(sealed.state, "Stay", f.random);
      expect(continued.state.round.hands[other]).toBe(
        sealed.state.round.hands[other],
      );
      expect(
        continued.state.round.skills!.players[other].activations[0].status,
      ).toBe("cancelled");
      expect(
        continued.state.round.skills!.players[other].hasSucceeded,
      ).toBeUndefined();
      expect(continued.state.round.skills!.players[other].disabled).toBe(true);
      expect(f.calls.skillEffects).toBe(0);
      assertBarrierLedger(continued);
    },
  );
  it("rejects a new secret activation after the seal without consuming a use", () => {
    const f = fixture({ ai: "metamorphosis" });
    const state = act(
      skill(f.state, "human", f.random).state,
      "Stay",
      f.random,
    ).state;
    const before = { ...f.calls };
    const result = transitionMatch(
      state,
      {
        type: "ActivateSkill",
        skillId: "metamorphosis",
        player: "ai",
        turnNumber: 2,
        roundNumber: 1,
      },
      f.random,
    );
    expect(result).toEqual({ state, events: [] });
    expect(f.calls).toEqual(before);
    expect(state.round.skills!.players.ai.remainingUses).toBe(5);
  });
  it("blocks directed Bandwagon, on-play and guaranteed Harvest supply without spending stock or selection RNG", () => {
    const f = fixture({
      first: "ai",
      ai: "endless-life",
      stock: { harvest: 1, bandwagon: 1, noop: 8, "grant-one": 1 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["harvest", "bandwagon", "noop"],
      effects: [0.99],
    });
    let state = play(f.state, "harvest", f.random).state;
    state = play(state, "bandwagon", f.random).state;
    state = skill(state, "ai", f.random).state;
    state = act(state, "Stay", f.random).state;
    state = play(state, "noop", f.random).state;
    state = skill(state, "human", f.random).state;
    const before = f.calls.trumpSelection,
      stock = state.round.trumps!.stock;
    const started = act(state, "Stay", f.random);
    expect(
      started.events.some(
        (e) =>
          e.type === "round" &&
          e.event.type === "resource" &&
          e.event.operation === "blocked",
      ),
    ).toBe(true);
    expect(started.state.round.trumps!.hands.ai[0].definitionId).toBe(
      "grant-one",
    );
    const played = play(started.state, "grant-one", f.random);
    expect(
      played.events.filter(
        (e) =>
          e.type === "round" &&
          e.event.type === "resource" &&
          e.event.operation === "blocked",
      ),
    ).toHaveLength(2);
    expect(played.state.round.trumps!.stock).toBe(stock);
    expect(f.calls.trumpSelection).toBe(before);
    expect(played.state.round.trumps!.table).toEqual([]);
    assertBarrierLedger(started);
    assertBarrierLedger(played);
  });
});

describe("Endless Life", () => {
  it("rejects initialization without a nonempty admitted difficulty pool before any RNG", () => {
    for (const stock of [undefined, {}, { noop: 0 }] as (
      Readonly<Record<string, number>> | undefined
    )[]) {
      const ports = fixturePorts({ human: "endless-life" });
      const rules = {
        ...ports.rules,
        trumps: {
          ...ports.rules.trumps!,
          ...(stock
            ? {
                resources: {
                  difficulty: "nightmare" as const,
                  handLimit: 8 as const,
                  gameGrant: 2 as const,
                  roundGrant: 1 as const,
                  hitProbability: 0.6,
                  stock,
                },
              }
            : {}),
        },
      };
      expect(() =>
        createMatch(ports.random, rules, ports.trumpSetup),
      ).toThrow();
      expect(ports.calls.numbers).toBe(0);
    }
  });
  it.each([0, 0.49, 0.51, 0.999])(
    "samples one definition uniformly at %s, independent of quantities and remaining stock",
    (sample) => {
      const f = fixture({
        human: "endless-life",
        stock: { noop: 20, "destroy-all": 1, "skill-revival": 0 },
        humanTrumps: ["noop", "noop", "noop"],
        aiTrumps: ["noop", "noop", "noop"],
        effects: [sample],
      });
      const armed = skill(f.state, "human", f.random).state;
      expect(armed.round.skills!.players.human.hasSucceeded).toBeUndefined();
      expect(f.calls.skillEffects).toBe(0);
      const stock = armed.round.trumps!.stock;
      const result = act(act(armed, "Stay", f.random).state, "Stay", f.random);
      const generated = result.state.round.trumps!.hands.human.at(-1)!;
      expect(generated.definitionId).toBe(
        sample < 0.5 ? "noop" : "destroy-all",
      );
      expect(isNullifyImmune(generated)).toBe(true);
      expect(result.state.round.trumps!.stock).toBe(stock);
      expect(result.state.round.skills!.players.human).toMatchObject({
        hasSucceeded: true,
        activations: [{ status: "succeeded" }],
      });
      expect(f.calls).toEqual({
        numbers: 11,
        trumpGate: 0,
        trumpSelection: 6,
        skillEffects: 1,
        skillSelection: 0,
      });
      const repeated = beginTurn(
        result.state.round,
        result.state.round.turn!,
        f.random,
      );
      expect(repeated).toEqual({ state: result.state.round, events: [] });
      assertBarrierLedger(result);
    },
  );
  it("generates from a depleted positive-quantity type without retrieving or consuming a stock instance", () => {
    const f = fixture({
      human: "endless-life",
      stock: { noop: 3 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    const result = act(
      act(skill(f.state, "human", f.random).state, "Stay", f.random).state,
      "Stay",
      f.random,
    );
    expect(result.state.round.trumps!.stock.human).toEqual([]);
    expect(result.state.round.trumps!.hands.human).toHaveLength(4);
    expect(f.calls.trumpSelection).toBe(6);
    assertBarrierLedger(result);
  });
  it("lets pending Endless Life start under disable and keeps its direct cards through Dispel All Arts", () => {
    const f = fixture({
      first: "ai",
      ai: "endless-life",
      stock: { noop: 4 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = act(
      skill(f.state, "ai", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = skill(state, "human", f.random).state;
    expect(state.round.skills!.players.ai.activations[0].status).toBe(
      "prepared",
    );
    const started = act(state, "Stay", f.random);
    expect(started.state.round.trumps!.hands.ai).toHaveLength(1);
    expect(isNullifyImmune(started.state.round.trumps!.hands.ai[0])).toBe(true);
    expect(started.state.round.skills!.players.ai.activations[0].status).toBe(
      "succeeded",
    );
    expect(started.state.round.skills!.players.ai.disabled).toBeUndefined();
    expect(
      observeMatch(started.state, "human").round.skills!.ai.disabled,
    ).toBeUndefined();
    assertBarrierLedger(started);
  });
  it("can first activate under the public seal without ever entering the opposing skill lock", () => {
    const f = fixture({
      ai: "endless-life",
      stock: { noop: 4 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = act(
      skill(f.state, "human", f.random).state,
      "Stay",
      f.random,
    ).state;
    expect(legalSkillCommands(observeMatch(state, "ai").round)).toHaveLength(1);
    state = skill(state, "ai", f.random).state;
    state = act(state, "Stay", f.random).state;
    const result = act(state, "Stay", f.random);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(1);
    expect(result.state.round.skills!.players.ai.hasSucceeded).toBe(true);
    expect(f.calls.skillEffects).toBe(1);
  });
  it("preserves a previously generated immune hand card and the active generator when Nullify resolves", () => {
    const f = fixture({
      first: "ai",
      ai: "endless-life",
      stock: { noop: 5 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = skill(f.state, "ai", f.random).state;
    state = act(state, "Stay", f.random).state;
    state = act(state, "Hit", f.random).state;
    const generated = state.round.trumps!.hands.ai.at(-1)!;
    state = act(state, "Stay", f.random).state;
    const sealed = skill(state, "human", f.random);
    expect(sealed.state.round.trumps!.hands.ai).toEqual([generated]);
    expect(sealed.state.round.skills!.players.ai.activations[0].status).toBe(
      "succeeded",
    );
    const later = act(sealed.state, "Stay", f.random);
    expect(later.state.round.trumps!.hands.ai).toHaveLength(2);
    expect(later.state.round.trumps!.hands.ai.every(isNullifyImmune)).toBe(
      true,
    );
    assertBarrierLedger(sealed);
    assertBarrierLedger(later);
  });
  it("survives Round cleanup, generates at the first own Turn of the next Round, and stops at Game cleanup", () => {
    const f = fixture({
      human: "endless-life",
      stock: { noop: 5, "sudden-death": 1 },
      humanTrumps: ["sudden-death", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = skill(f.state, "human", f.random).state;
    state = finish(state, f.random);
    expect(state.round.skills!.players.human.activations[0]).toMatchObject({
      status: "succeeded",
      effect: { type: "endless-life" },
    });
    const count = f.calls.skillEffects;
    state = next(f, state).state;
    expect(f.calls.skillEffects).toBe(count);
    state = act(state, "Stay", f.random).state;
    expect(f.calls.skillEffects).toBe(count + 1);
    const playing = play(state, "sudden-death", f.random).state;
    state = finish(playing, f.random);
    expect(state.phase).toBe("game-complete");
    expect(
      state.round.skills!.players.human.activations[0].effect,
    ).toBeUndefined();
    expect(state.round.skills!.players.human.hasSucceeded).toBe(true);
    const calls = f.calls.skillEffects;
    const game = next(f, state).state;
    expect(game.round.skills!.players.human.activations).toEqual([]);
    expect(game.round.skills!.players.human.remainingUses).toBe(0);
    expect(f.calls.skillEffects).toBe(calls);
  });
  it("skips RNG at full hand, retains a pending generator across Rounds, then succeeds after a slot is freed", () => {
    const f = fixture({
      human: "endless-life",
      stock: { "fill-hand": 1, noop: 20 },
      humanTrumps: ["fill-hand", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = skill(
      play(f.state, "fill-hand", f.random).state,
      "human",
      f.random,
    ).state;
    state = act(act(state, "Stay", f.random).state, "Stay", f.random).state;
    expect(state.round.trumps!.hands.human).toHaveLength(8);
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "prepared",
    );
    expect(state.round.skills!.players.human.hasSucceeded).toBeUndefined();
    expect(f.calls.skillEffects).toBe(0);
    state = finish(state, f.random);
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "prepared",
    );
    state = next(f, state).state;
    state = act(state, "Stay", f.random).state;
    expect(f.calls.skillEffects).toBe(0);
    expect(
      observeMatch(state, "human").round.skills!.human.canRecover,
    ).toBeUndefined();
    state = play(state, "noop", f.random).state;
    state = act(state, "Hit", f.random).state;
    const result = act(state, "Stay", f.random);
    expect(result.state.round.trumps!.hands.human).toHaveLength(8);
    expect(result.state.round.skills!.players.human.hasSucceeded).toBe(true);
    expect(f.calls.skillEffects).toBe(1);
    assertBarrierLedger(result);
  });
  it("expires a generator with no successful supply at Game end and does not count it as recoverable", () => {
    const f = fixture({
      human: "endless-life",
      stock: {
        "fill-hand": 1,
        "sudden-death": 1,
        "shared-supply": 1,
        noop: 20,
      },
      humanTrumps: ["fill-hand", "sudden-death", "noop"],
      aiTrumps: ["shared-supply", "noop", "noop"],
    });
    let state = play(f.state, "fill-hand", f.random).state;
    state = play(state, "sudden-death", f.random).state;
    state = act(skill(state, "human", f.random).state, "Stay", f.random).state;
    state = play(state, "shared-supply", f.random).state;
    state = finish(state, f.random);
    expect(state.phase).toBe("game-complete");
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "expired",
    );
    expect(state.round.skills!.players.human.hasSucceeded).toBeUndefined();
    expect(
      observeMatch(state, "human").round.skills!.human.canRecover,
    ).toBeUndefined();
    expect(f.calls.skillEffects).toBe(0);
  });
  it("allows fixed nonimmune generation and ordinary use under the seal", () => {
    const f = fixture({
      first: "ai",
      ai: "endless-life",
      stock: { noop: 6, "gen-hand": 1 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
      effects: [0.99],
    });
    let state = act(
      skill(f.state, "ai", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = act(skill(state, "human", f.random).state, "Stay", f.random).state;
    const direct = state.round.trumps!.hands.ai[0];
    expect(isNullifyImmune(direct)).toBe(true);
    state = play(state, "gen-hand", f.random).state;
    expect(state.round.trumps!.hands.ai).toHaveLength(1);
    expect(isNullifyImmune(state.round.trumps!.hands.ai[0])).toBe(false);
    const result = play(state, "noop", f.random);
    expect(result.state.round.trumps!.hands.ai).toEqual([]);
    expect(result.state.round.skills!.seal).toBeDefined();
    expect(f.calls.trumpSelection).toBe(6);
    assertBarrierLedger(result);
  });
  it("does not protect direct cards against explicit all-other costs", () => {
    const f = fixture({
      human: "endless-life",
      stock: { noop: 12, "purge-hand": 1 },
      humanTrumps: ["purge-hand", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = act(
      act(skill(f.state, "human", f.random).state, "Stay", f.random).state,
      "Stay",
      f.random,
    ).state;
    const direct = state.round.trumps!.hands.human.at(-1)!;
    expect(isNullifyImmune(direct)).toBe(true);
    const result = play(state, "purge-hand", f.random);
    expect(
      result.state.round.trumps!.destroyed.some(
        (d) => d.instance === direct && d.reason === "cost",
      ),
    ).toBe(true);
    expect(result.state.round.trumps!.hands.human).not.toContain(direct);
    assertBarrierLedger(result);
  });
  it("continues a generator across sealed Round opening grants without drawing stock", () => {
    const f = fixture({
      first: "ai",
      ai: "endless-life",
      stock: { noop: 5 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = act(
      skill(f.state, "ai", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = finish(skill(state, "human", f.random).state, f.random);
    const generated = f.calls.skillEffects;
    const continued = next(f, state);
    expect(continued.state.round.trumps!.hands.human).toEqual([]);
    expect(f.calls.trumpSelection).toBe(6);
    const result = act(continued.state, "Stay", f.random);
    expect(f.calls.skillEffects).toBe(generated + 1);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(generated + 1);
    expect(result.state.round.skills!.seal).toEqual({ throughRound: 3 });
    assertBarrierLedger(continued);
    assertBarrierLedger(result);
  });
  it("ends an active seal and generator at sudden-death Game cleanup, then grants a fresh Game stock normally", () => {
    const f = fixture({
      first: "ai",
      ai: "endless-life",
      stock: { noop: 5, "sudden-death": 1 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
      effects: [0.99],
    });
    let state = act(
      skill(f.state, "ai", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = act(skill(state, "human", f.random).state, "Stay", f.random).state;
    state = finish(play(state, "sudden-death", f.random).state, f.random);
    expect(state.phase).toBe("game-complete");
    expect(state.round.skills!.seal).toBeUndefined();
    expect(state.round.skills!.players.ai.disabled).toBeUndefined();
    expect(
      state.round.skills!.players.ai.activations[0].effect,
    ).toBeUndefined();
    const effects = f.calls.skillEffects;
    const result = next(f, state);
    expect(result.state.game.number).toBe(2);
    expect(result.state.round.trumps!.hands.human).toHaveLength(3);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(3);
    expect(f.calls.trumpSelection).toBe(12);
    expect(f.calls.skillEffects).toBe(effects);
    assertBarrierLedger(result);
  });
  it("preserves the direct origin on Pickpocket transfer and drops it on a Twin Bloom copy", () => {
    for (const id of ["pickpocket", "twin-bloom"] as const) {
      const f = fixture({
        human: id,
        ai: "endless-life",
        first: "ai",
        stock: { noop: 5 },
        humanTrumps: ["noop", "noop", "noop"],
        aiTrumps: ["noop", "noop", "noop"],
        effects: [0, 0.999],
      });
      let state = act(
        skill(f.state, "ai", f.random).state,
        "Stay",
        f.random,
      ).state;
      state = act(state, "Hit", f.random).state;
      const original = state.round.trumps!.hands.ai.at(-1)!;
      expect(isNullifyImmune(original)).toBe(true);
      if (id === "twin-bloom") {
        state = skill(state, "human", f.random).state;
        state = act(state, "Stay", f.random).state;
        const copied = state.round.trumps!.hands.human.at(-1)!;
        expect(copied.instanceId).not.toBe(original.instanceId);
        expect(isNullifyImmune(copied)).toBe(false);
      } else {
        state = act(state, "Stay", f.random).state;
        state = skill(state, "human", f.random).state;
        const moved = state.round.trumps!.hands.human.at(-1)!;
        expect(moved).toBe(original);
        expect(isNullifyImmune(moved)).toBe(true);
      }
      assertBarrierLedger({ state, events: [] });
    }
  });
});
