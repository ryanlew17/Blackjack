// @req REQ-2026-027: recovery requires real Match success and reverses only still-available credits.
import { describe, expect, it } from "vitest";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  projectMatchTransition,
  legalSkillCommands,
  legalTrumpCommands,
} from "./index";
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
import { ADMITTED_TRUMP_DEFINITIONS } from "../trumps/admitted";
import { SKILL_TRUMP_DEFINITIONS } from "../trumps/skillDefinitions";

const recoverable = (
  state: ReturnType<typeof fixture>["state"],
  player: "human" | "ai" = "human",
) => observeMatch(state, player).round.skills![player].canRecover === true;

describe("Skill Revival availability and actual recovery", () => {
  it.each(["human", "ai"] as const)(
    "restores %s's successful skill up to its initial cap and adds one Game permission",
    (player) => {
      const f = fixture({
        human: "spirit-sight",
        ai: "spirit-sight",
        first: player,
        humanTrumps: ["skill-revival", "skill-revival"],
        aiTrumps: ["skill-revival", "skill-revival"],
      });
      const initial = f.state.round.skills!.players[player];
      expect(recoverable(f.state, player)).toBe(false);
      let state = skill(f.state, player, f.random).state;
      expect(recoverable(state, player)).toBe(true);
      const result = play(state, "skill-revival", f.random);
      state = result.state;
      expect(state.round.skills!.players[player]).toMatchObject({
        remainingUses: initial.remainingUses,
        gameActivationsRemaining: 1,
        hasSucceeded: true,
      });
      expect(recoverable(state, player)).toBe(false);
      expect(
        legalTrumpCommands(observeMatch(state, player).round).some(
          (c) =>
            c.instanceId === state.round.trumps!.hands[player][0].instanceId,
        ),
      ).toBe(false);
      const before = { ...f.calls };
      const rejected = transitionMatch(
        state,
        {
          type: "PlayTrump",
          player,
          instanceId: state.round.trumps!.hands[player][0].instanceId,
          roundNumber: 1,
        },
        f.random,
      );
      expect(rejected).toEqual({ state, events: [] });
      expect(f.calls).toEqual(before);
      state = skill(state, player, f.random).state;
      expect(state.round.skills!.players[player].remainingUses).toBe(
        initial.remainingUses - 1,
      );
      expect(state.round.skills!.players[player].gameActivationsRemaining).toBe(
        0,
      );
      expect(state.round.skills!.players[player].activations).toHaveLength(2);
      expect(
        result.events.some(
          (e) =>
            e.type === "round" &&
            e.event.type === "trump" &&
            e.event.effect === "skill-recovered",
        ),
      ).toBe(true);
      assertBarrierLedger(result);
    },
  );
  it("rejects a recovery card before any successful skill without consuming it or any random stream", () => {
    const f = fixture({
      human: "spirit-sight",
      humanTrumps: ["skill-revival"],
    });
    const before = { ...f.calls };
    const result = transitionMatch(
      f.state,
      { type: "PlayTrump", player: "human", instanceId: "h-0", roundNumber: 1 },
      f.random,
    );
    expect(result).toEqual({ state: f.state, events: [] });
    expect(f.calls).toEqual(before);
    expect(f.state.round.trumps!.hands.human).toHaveLength(1);
  });
  it.each(["frame", "metamorphosis", "provoke", "soul-transfer"] as const)(
    "does not count prepared %s as a success",
    (id) => {
      const f = fixture({ human: id, humanTrumps: ["skill-revival"] });
      const state = skill(f.state, "human", f.random).state;
      expect(state.round.skills!.players.human.activations[0].status).toBe(
        "prepared",
      );
      expect(recoverable(state)).toBe(false);
      expect(legalTrumpCommands(observeMatch(state, "human").round)).toEqual(
        [],
      );
      expect(
        transitionMatch(
          state,
          {
            type: "PlayTrump",
            player: "human",
            instanceId: "h-0",
            roundNumber: 1,
          },
          f.random,
        ),
      ).toEqual({ state, events: [] });
    },
  );
  it("does not count a pending Twin reaction as success", () => {
    const f = fixture({
      first: "ai",
      human: "twin-bloom",
      humanTrumps: ["skill-revival"],
    });
    const state = skill(f.state, "human", f.random).state;
    expect(recoverable(state)).toBe(false);
    expect(state.round.skills!.players.human.hasSucceeded).toBeUndefined();
  });
  it("does not count Fortune's empty-stock miss as success", () => {
    const f = fixture({ human: "fortune", humanTrumps: ["skill-revival"] });
    const state = skill(f.state, "human", f.random).state;
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "ineffective",
    );
    expect(recoverable(state)).toBe(false);
    expect(legalTrumpCommands(observeMatch(state, "human").round)).toEqual([]);
  });
  it("does not count a cancelled public pending skill as a success", () => {
    const f = fixture({ human: "frame", ai: "nullify" });
    let state = act(
      skill(f.state, "human", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = skill(state, "ai", f.random).state;
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "cancelled",
    );
    expect(recoverable(state)).toBe(false);
  });
  it("does not count a secretly expired Soul as success in the next Round", () => {
    const f = fixture({
      human: "soul-transfer",
      humanTrumps: ["skill-revival"],
    });
    let state = finish(skill(f.state, "human", f.random).state, f.random);
    expect(state.round.skills!.players.human.activations[0].status).toBe(
      "expired",
    );
    f.addRound();
    state = transitionMatch(
      state,
      { type: "NextRound", roundNumber: 1 },
      f.random,
    ).state;
    state = act(state, "Stay", f.random).state;
    expect(recoverable(state)).toBe(false);
    expect(legalTrumpCommands(observeMatch(state, "human").round)).toEqual([]);
  });
  it("retains Match success across Game cleanup and allows recovery before any activation in the new Game", () => {
    const f = fixture({
      human: "spirit-sight",
      humanTrumps: ["sudden-death", "skill-revival"],
    });
    let state = skill(f.state, "human", f.random).state;
    state = finish(play(state, "sudden-death", f.random).state, f.random);
    expect(state.phase).toBe("game-complete");
    f.addRound();
    state = transitionMatch(
      state,
      { type: "NextRound", roundNumber: 1 },
      f.random,
    ).state;
    state = act(state, "Stay", f.random).state;
    expect(state.game.number).toBe(2);
    expect(state.round.skills!.players.human.activations).toEqual([]);
    expect(recoverable(state)).toBe(true);
    state = play(state, "skill-revival", f.random).state;
    expect(state.round.skills!.players.human).toMatchObject({
      remainingUses: 4,
      gameActivationsRemaining: 2,
      hasSucceeded: true,
    });
    expect(state.round.skills!.players.human.activations).toEqual([]);
  });
  it("restores the disabled opponent's budget after the public seal expires without clearing its Game disable", () => {
    const f = fixture({
      first: "ai",
      human: "nullify",
      ai: "spirit-sight",
      stock: { "skill-revival": 1, noop: 12 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = act(
      skill(f.state, "ai", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = skill(state, "human", f.random).state;
    for (let round = 1; round <= 3; round++) {
      state = finish(state, f.random);
      f.addRound();
      state = transitionMatch(
        state,
        { type: "NextRound", roundNumber: state.roundNumber },
        f.random,
      ).state;
    }
    state = act(state, "Stay", f.random).state;
    expect(state.round.turn!.player).toBe("ai");
    expect(state.round.skills!.seal).toBeUndefined();
    expect(recoverable(state, "ai")).toBe(true);
    const result = play(state, "skill-revival", f.random);
    expect(result.state.round.skills!.players.ai).toMatchObject({
      remainingUses: 4,
      gameActivationsRemaining: 1,
      disabled: true,
    });
    expect(legalSkillCommands(observeMatch(result.state, "ai").round)).toEqual(
      [],
    );
    expect(result.state.round.skills!.players.ai.activations[0].status).toBe(
      "succeeded",
    );
    assertBarrierLedger(result);
  });
  it("redirects actual recovery to Soul's controller after that interception itself succeeds", () => {
    const f = fixture({
      human: "soul-transfer",
      ai: "spirit-sight",
      aiTrumps: ["skill-revival"],
    });
    let state = act(
      skill(f.state, "human", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = skill(state, "ai", f.random).state;
    const before = state.round.skills!.players.ai;
    const result = play(state, "skill-revival", f.random);
    expect(result.state.round.skills!.players.human).toMatchObject({
      remainingUses: 3,
      gameActivationsRemaining: 1,
      hasSucceeded: true,
    });
    expect(result.state.round.skills!.players.ai.remainingUses).toBe(
      before.remainingUses,
    );
    expect(result.state.round.skills!.players.ai.gameActivationsRemaining).toBe(
      0,
    );
    expect(
      result.state.round.trumps!.hands.human.map((c) => c.definitionId),
    ).toEqual(["regret"]);
    expect(result.state.round.lastPlay).toMatchObject({
      player: "ai",
      effectPlayer: "human",
      deltas: [{ type: "skill-recovery", player: "human" }],
    });
    state = act(result.state, "Stay", f.random).state;
    const undone = play(state, "regret", f.random);
    expect(undone.state.round.skills!.players.human).toMatchObject({
      remainingUses: 2,
      gameActivationsRemaining: 0,
      hasSucceeded: true,
    });
    expect(undone.state.round.skills!.players.human.activations[0].status).toBe(
      "succeeded",
    );
    expect(
      undone.state.round.trumps!.destroyed.some(
        (d) => d.instance.definitionId === "skill-revival" && d.owner === "ai",
      ),
    ).toBe(true);
    assertBarrierLedger(result);
    assertBarrierLedger(undone);
  });
  it("uses the admitted recovery definition without permitting recovery in a no-skill match", () => {
    expect(SKILL_TRUMP_DEFINITIONS["skill-revival"].onPlay).toEqual([
      { type: "recover-skill-use" },
    ]);
    expect(ADMITTED_TRUMP_DEFINITIONS["skill-revival"]).toBe(
      SKILL_TRUMP_DEFINITIONS["skill-revival"],
    );
    const ports = fixturePorts({ humanTrumps: ["skill-revival"] });
    const { skills: _skills, ...rules } = ports.rules;
    const state = createMatch(ports.random, rules, ports.trumpSetup).state;
    expect(legalTrumpCommands(observeMatch(state, "human").round)).toEqual([]);
    expect(
      transitionMatch(
        state,
        {
          type: "PlayTrump",
          player: "human",
          instanceId: "h-0",
          roundNumber: 1,
        },
        ports.random,
      ),
    ).toEqual({ state, events: [] });
  });
});

describe("actual recovery inverse and continuing generators", () => {
  it("undoes and redoes only actual recovery credits, retaining skill success, knowledge and destroyed cards", () => {
    const f = fixture({
      human: "spirit-sight",
      humanTrumps: ["skill-revival", "regret", "regret"],
    });
    const succeeded = skill(f.state, "human", f.random).state;
    const restored = play(succeeded, "skill-revival", f.random).state;
    const undone = play(restored, "regret", f.random).state;
    expect(undone.round.skills!.players.human).toEqual(
      succeeded.round.skills!.players.human,
    );
    expect(observeMatch(undone, "human").round.hands.ai.cards[0].value).toBe(8);
    const result = play(undone, "regret", f.random);
    expect(result.state.round.skills!.players.human).toEqual(
      restored.round.skills!.players.human,
    );
    expect(result.state.round.trumps!.destroyed).toHaveLength(3);
    expect(f.calls.skillEffects).toBe(0);
    assertBarrierLedger(result);
  });
  it("keeps a later secret activation committed and the opposing inverse projection identical to the unspent world", () => {
    const f = fixture({
      human: "metamorphosis",
      humanTrumps: ["skill-revival", "regret"],
      prefix: [1, 8, 11, 9],
    });
    let state = finish(skill(f.state, "human", f.random).state, f.random);
    f.addRound();
    state = transitionMatch(
      state,
      { type: "NextRound", roundNumber: 1 },
      f.random,
    ).state;
    state = act(state, "Stay", f.random).state;
    const restored = play(state, "skill-revival", f.random).state;
    const prepared = skill(restored, "human", f.random).state;
    expect(observeMatch(prepared, "ai")).toEqual(observeMatch(restored, "ai"));
    const spent = play(prepared, "regret", f.random),
      unspent = play(restored, "regret", f.random);
    expect(projectMatchTransition(spent, "ai")).toEqual(
      projectMatchTransition(unspent, "ai"),
    );
    expect(spent.state.round.skills!.players.human).toMatchObject({
      remainingUses: 3,
      gameActivationsRemaining: 0,
    });
    expect(spent.state.round.skills!.players.human.activations).toHaveLength(2);
    expect(spent.state.round.skills!.players.human.activations[1].status).toBe(
      "prepared",
    );
    assertBarrierLedger(spent);
  });
  it("allows recovery and a second immune generator under Nullify without removing either public restriction", () => {
    const f = fixture({
      first: "ai",
      ai: "endless-life",
      stock: { noop: 8, "skill-revival": 1 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
      effects: [0.99, 0, 0],
    });
    let state = act(
      skill(f.state, "ai", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = act(skill(state, "human", f.random).state, "Stay", f.random).state;
    expect(recoverable(state, "ai")).toBe(true);
    state = play(state, "skill-revival", f.random).state;
    expect(state.round.skills!.seal).toEqual({ throughRound: 3 });
    expect(state.round.skills!.players.ai.disabled).toBeUndefined();
    state = skill(state, "ai", f.random).state;
    expect(state.round.skills!.players.ai.activations).toHaveLength(2);
    state = act(state, "Stay", f.random).state;
    const result = act(state, "Stay", f.random);
    expect(result.state.round.trumps!.hands.ai).toHaveLength(2);
    expect(
      result.state.round.skills!.players.ai.activations.map((a) => a.status),
    ).toEqual(["succeeded", "succeeded"]);
    expect(f.calls.skillEffects).toBe(3);
    expect(f.calls.trumpSelection).toBe(6);
    assertBarrierLedger(result);
  });
  it("does not underflow or refund a recovery credit already spent on a second generator", () => {
    const f = fixture({
      human: "endless-life",
      stock: { noop: 5, "skill-revival": 1, regret: 2 },
      humanTrumps: ["skill-revival", "regret", "regret"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    let state = act(
      act(skill(f.state, "human", f.random).state, "Stay", f.random).state,
      "Stay",
      f.random,
    ).state;
    state = play(state, "skill-revival", f.random).state;
    state = skill(state, "human", f.random).state;
    state = play(state, "regret", f.random).state;
    expect(state.round.skills!.players.human).toMatchObject({
      remainingUses: 0,
      gameActivationsRemaining: 0,
    });
    expect(state.round.skills!.players.human.activations).toHaveLength(2);
    state = play(state, "regret", f.random).state;
    expect(state.round.skills!.players.human).toMatchObject({
      remainingUses: 0,
      gameActivationsRemaining: 0,
    });
    expect(state.round.skills!.players.human.activations[1].status).toBe(
      "prepared",
    );
    assertBarrierLedger({ state, events: [] });
  });
});
