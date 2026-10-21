// @req REQ-2026-024: real resource commands, finite triggers and precise Turn lifetimes.
import { describe, it, expect, vi } from "vitest";
import { freezeData } from "../immutable";
import {
  observeMatch,
  legalTrumpCommands,
  legalMatchActions,
  deleteNumber,
} from "./index";
import { beginTurn } from "./triggers";
import { deleteTrump } from "./resources";
import {
  fixture,
  play,
  act,
  finish,
  ledger,
  hand,
  table,
} from "./interactionTestHelpers";
const streams = () => ({
  numbers: vi.fn(() => {
    throw new Error("Unexpected number RNG");
  }),
  trumpGate: vi.fn(() => 0),
  trumpSelection: vi.fn(() => 0),
});
const faces = (s: ReturnType<typeof fixture>, p: "human" | "ai" = "human") =>
  s.round.hands[p].map((c) => c.value);
describe("resources and finite consumption triggers", () => {
  it("Shared Supply grants actor before opponent and keeps the Turn", () => {
    const state = fixture(["shared-supply"]),
      random = streams(),
      result = play(state, "shared-supply", {}, random);
    ledger(result);
    const draws = result.events.flatMap((e) =>
      e.type === "round" && e.event.type === "resource" ? [e.event] : [],
    );
    expect(draws.map((e) => e.player)).toEqual(["human", "ai"]);
    expect(hand(result.state)).toHaveLength(1);
    expect(hand(result.state, "ai")).toHaveLength(1);
    expect(result.state.round.turn).toEqual({
      player: "human",
      number: 1,
      usedTrump: true,
    });
    expect(random.trumpSelection).toHaveBeenCalledTimes(2);
    expect(random.trumpGate).not.toHaveBeenCalled();
  });
  it.each([0, 1, 2])(
    "Refit pays one hidden cost even when only %s cards remain",
    (remaining) => {
      const original = fixture(["resource-swap", "shield"], [], undefined, {
        pressure: remaining,
      });
      // The opponent's unused setup copies also exist in our stock; drain only the non-requested stock via fixture selection.
      let trumps = original.round.trumps!;
      for (const c of [...trumps.stock.human])
        if (c.definitionId !== "pressure")
          trumps = deleteTrump(trumps, "human", c.instanceId);
      const state = freezeData({
        ...original,
        round: { ...original.round, trumps },
      });
      const random = streams(),
        result = play(state, "resource-swap", {}, random);
      ledger(result);
      expect(hand(result.state)).toHaveLength(remaining);
      expect(
        result.state.round.trumps!.destroyed.map((d) => [d.reason, d.public]),
      ).toEqual([
        ["played", true],
        ["cost", false],
      ]);
      expect(random.trumpSelection).toHaveBeenCalledTimes(remaining);
      expect(result.state.round.turn!.usedTrump).toBe(true);
    },
  );
  it("rejects missing, duplicate or forged costs with zero resource advancement", () => {
    const state = fixture(["resource-swap", "shield"]),
      random = streams();
    for (const costIds of [
      [],
      ["missing"],
      [hand(state)[1].instanceId, hand(state)[1].instanceId],
    ]) {
      const result = play(state, "resource-swap", { costIds }, random);
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    }
    const noCost = fixture(["resource-swap"]);
    expect(play(noCost, "resource-swap").state).toBe(noCost);
    expect(random.trumpGate).not.toHaveBeenCalled();
    expect(random.trumpSelection).not.toHaveBeenCalled();
  });
  it("Clean Slate consumes all other cards, receives at most three, and cannot run without a cost", () => {
    const state = fixture(["purge-hand", "shield", "pressure", "regret"]),
      result = play(state, "purge-hand");
    ledger(result);
    expect(hand(result.state)).toHaveLength(3);
    expect(
      result.state.round.trumps!.destroyed.filter((d) => d.reason === "cost"),
    ).toHaveLength(3);
    expect(
      play(state, "purge-hand", { costIds: [hand(state)[1].instanceId] }).state,
    ).toBe(state);
    const empty = fixture(["purge-hand"]);
    expect(play(empty, "purge-hand").state).toBe(empty);
  });
  it("Prepared Pressure rejects a full table before grants/costs and still installs on empty stock", () => {
    let state = fixture([...Array(5).fill("shield"), "pressure-supply"]);
    for (let i = 0; i < 5; i++) state = play(state, "shield").state;
    const random = streams(),
      rejected = play(state, "pressure-supply", {}, random);
    expect(rejected.state).toBe(state);
    expect(rejected.events).toEqual([]);
    expect(random.trumpSelection).not.toHaveBeenCalled();
    const empty = fixture(["pressure-supply"], [], undefined, {}),
      result = play(empty, "pressure-supply");
    ledger(result);
    expect(table(result.state, "pressure-supply")).toHaveLength(1);
    expect(hand(result.state)).toEqual([]);
  });
  it("a full opposing hand does not roll back the actor's grant", () => {
    const state = fixture(["shared-supply"], Array(8).fill("shield")),
      random = streams();
    const result = play(state, "shared-supply", {}, random);
    ledger(result);
    expect(hand(result.state)).toHaveLength(1);
    expect(hand(result.state, "ai")).toHaveLength(8);
    expect(random.trumpSelection).toHaveBeenCalledTimes(1);
  });
  it("Reserve excludes its installation, costs, grants and the other player's plays; consumes two charges even on failure", () => {
    let state = fixture(
      ["harvest", "resource-swap", "shield", "pressure"],
      ["pressure"],
    );
    const random = streams();
    state = play(state, "harvest", {}, random).state;
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expect(table(state, "harvest")[0].remainingCharges).toBe(2);
    const refit = play(
      state,
      "resource-swap",
      {
        costIds: [
          hand(state).find((c) => c.definitionId === "shield")!.instanceId,
        ],
      },
      random,
    );
    ledger(refit);
    state = refit.state;
    expect(table(state, "harvest")[0].remainingCharges).toBe(1);
    expect(random.trumpSelection).toHaveBeenCalledTimes(3);
    state = act(state, "Stay").state;
    state = play(state, "pressure").state;
    expect(table(state, "harvest")[0].remainingCharges).toBe(1);
    state = act(state, "Stay").state;
    const last = play(state, "pressure", {}, random);
    ledger(last);
    expect(table(last.state, "harvest")).toEqual([]);
    expect(random.trumpSelection).toHaveBeenCalledTimes(4);
    let exhausted = fixture(["harvest", "shield", "shield"], [], undefined, {});
    exhausted = play(exhausted, "harvest").state;
    exhausted = play(exhausted, "shield").state;
    expect(table(exhausted, "harvest")[0].remainingCharges).toBe(1);
    exhausted = play(exhausted, "shield").state;
    expect(table(exhausted, "harvest")).toEqual([]);
  });
  it("existing Reserves resolve in placement order and new ones never self-trigger", () => {
    let state = fixture(["harvest", "harvest", "shield"]),
      random = streams();
    state = play(state, "harvest", {}, random).state;
    state = play(state, "harvest", {}, random).state;
    expect(table(state, "harvest").map((t) => t.remainingCharges)).toEqual([
      1, 2,
    ]);
    const ids = table(state, "harvest").map((t) => t.effectId),
      result = play(state, "shield", {}, random);
    ledger(result);
    const updated = result.events.flatMap((e) =>
      e.type === "round" &&
      e.event.type === "table-effect" &&
      e.event.operation === "updated"
        ? [e.event.effectId]
        : [],
    );
    expect(updated).toEqual(ids);
    expect(
      table(result.state, "harvest").map((t) => t.remainingCharges),
    ).toEqual([1]);
    expect(random.trumpSelection).toHaveBeenCalledTimes(3);
  });
  it("decommission cancels its Reserve before the consumption-trigger pass", () => {
    let state = play(fixture(["harvest", "decommission"]), "harvest").state;
    const random = streams(),
      result = play(state, "decommission", {}, random);
    ledger(result);
    expect(table(result.state, "harvest")).toEqual([]);
    expect(random.trumpSelection).toHaveBeenCalledTimes(1);
    expect(hand(result.state)).toHaveLength(1);
  });
  it("Open Hand keeps its information when undone, but reverses the actual grant", () => {
    const original = fixture(["reveal-self", "regret"]),
      result = play(original, "reveal-self");
    ledger(result);
    expect(observeMatch(result.state, "ai").round.hands.human.cards[0]).toEqual(
      { value: 10, faceDown: false },
    );
    const undo = play(result.state, "regret");
    ledger(undo);
    expect(
      observeMatch(undo.state, "ai").round.hands.human.cards[0].value,
    ).toBe(10);
    expect(hand(undo.state)).toEqual([]);
  });
  it("Risk for Supply draws a number then up to two trumps without Hit/gate/handover", () => {
    const state = fixture(["life-trade"]),
      random = streams(),
      result = play(state, "life-trade", {}, random);
    ledger(result);
    expect(faces(result.state)).toEqual([10, 11, 1]);
    expect(hand(result.state)).toHaveLength(2);
    expect(result.state.round.turn!.player).toBe("human");
    expect(random.trumpGate).not.toHaveBeenCalled();
    expect(random.trumpSelection).toHaveBeenCalledTimes(2);
  });
  it("Follow Suit observes only the next opponent Turn's first legal consumption and retrieves one real stock copy", () => {
    let state = fixture(["bandwagon"], ["draw-2", "pressure"]),
      random = streams();
    state = play(state, "bandwagon", {}, random).state;
    state = act(state, "Stay", random).state;
    const illegal = play(state, "draw-2", { costIds: ["wrong"] }, random);
    expect(illegal.state).toBe(state);
    state = play(state, "draw-2", {}, random).state;
    state = play(state, "pressure", {}, random).state;
    expect(table(state, "bandwagon")[0].copiedDefinitionId).toBe("draw-2");
    const stockId = state.round.trumps!.stock.human.find(
      (c) => c.definitionId === "draw-2",
    )!.instanceId;
    const result = act(state, "Stay", random);
    ledger(result);
    expect(hand(result.state).map((c) => c.instanceId)).toContain(stockId);
    expect(table(result.state, "bandwagon")).toEqual([]);
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expect(random.trumpGate).not.toHaveBeenCalled();
    expect(
      beginTurn(result.state.round, result.state.round.turn!, random).events,
    ).toEqual([]);
  });
  it.each(["unused", "missing", "full", "destroyed"])(
    "Follow Suit expires on %s without duplicating or replaying a card",
    (mode) => {
      let state = fixture(
        ["bandwagon", ...(mode === "full" ? Array(7).fill("shield") : [])],
        ["pressure", "destroy"],
        undefined,
        mode === "missing" ? {} : { pressure: 2 },
      );
      // Remove the only matching copy from our stock beforehand, as a controlled exhausted-stock arrangement.
      if (mode === "missing") {
        let trumps = state.round.trumps!;
        for (const c of [...trumps.stock.human])
          if (c.definitionId === "pressure")
            trumps = deleteTrump(trumps, "human", c.instanceId);
        state = freezeData({ ...state, round: { ...state.round, trumps } });
      }
      state = play(state, "bandwagon").state;
      if (mode === "full") {
        // Fill the one slot vacated by installation via an ordinary successful Hit, which ends this Turn.
        state = act(state, "Hit").state;
      } else state = act(state, "Stay").state;
      if (mode !== "unused")
        state = play(
          state,
          mode === "destroyed" ? "destroy" : "pressure",
        ).state;
      const before = hand(state).length,
        result = act(state, "Stay");
      ledger(result);
      expect(table(result.state, "bandwagon")).toEqual([]);
      expect(hand(result.state)).toHaveLength(before);
    },
  );
});

describe("Turn-bound locks, draw modifiers and suppression", () => {
  it("Quiet Window blocks only ordinary Hit during the exact next Turn, and leaves counters and Stay available", () => {
    let state = fixture(["hush"], ["draw-2", "destroy"]);
    state = play(state, "hush").state;
    expect(legalMatchActions(observeMatch(state, "human"))).toContain("Hit");
    state = act(state, "Stay").state;
    expect(legalMatchActions(observeMatch(state, "ai"))).not.toContain("Hit");
    expect(act(state, "Hit").state).toBe(state);
    state = play(state, "draw-2").state;
    expect(faces(state, "ai")).toContain(2);
    state = play(state, "destroy").state;
    expect(legalMatchActions(observeMatch(state, "ai"))).toContain("Hit");
    state = act(state, "Stay").state;
    expect(table(state, "hush")).toEqual([]);
  });
  it("Quiet Window expires unused at its target Turn's end and same-owner duplicates are refused", () => {
    let state = fixture(["hush", "hush"]);
    state = play(state, "hush").state;
    expect(play(state, "hush").state).toBe(state);
    state = act(state, "Stay").state;
    const result = act(state, "Stay");
    ledger(result);
    expect(table(result.state, "hush")).toEqual([]);
    expect(result.state.round.turn!.number).toBe(3);
  });
  it("Embargo blocks exactly one otherwise possible grant and does not use selection RNG", () => {
    let state = fixture(["embargo"], ["resource-swap", "shield"]);
    state = play(state, "embargo").state;
    state = act(state, "Stay").state;
    const random = streams(),
      result = play(state, "resource-swap", {}, random);
    ledger(result);
    const resources = result.events.flatMap((e) =>
      e.type === "round" && e.event.type === "resource" ? [e.event] : [],
    );
    expect(resources.map((e) => e.operation)).toEqual([
      "delete",
      "blocked",
      "draw",
    ]);
    expect(hand(result.state, "ai")).toHaveLength(1);
    expect(table(result.state, "embargo")).toEqual([]);
    expect(random.trumpSelection).toHaveBeenCalledTimes(1);
  });
  it("Embargo keeps its charge on a full hand and expires at the proper boundary", () => {
    let state = fixture(["embargo"], Array(8).fill("shield"));
    state = play(state, "embargo").state;
    state = act(state, "Stay").state;
    const random = streams(),
      result = act(state, "Hit", random);
    ledger(result);
    expect(
      result.events.flatMap((e) =>
        e.type === "round" && e.event.type === "resource"
          ? [e.event.operation]
          : [],
      ),
    ).toEqual(["draw"]);
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expect(table(result.state, "embargo")).toEqual([]);
  });
  it("Embargo applies to an ordinary Hit grant before the lock expires, leaving its number intact", () => {
    let state = play(fixture(["embargo"]), "embargo").state;
    state = act(state, "Stay").state;
    const random = streams(),
      result = act(state, "Hit", random);
    ledger(result);
    expect(faces(result.state, "ai")).toEqual([8, 9, 1]);
    expect(hand(result.state, "ai")).toEqual([]);
    expect(random.trumpGate).toHaveBeenCalledTimes(1);
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expect(table(result.state, "embargo")).toEqual([]);
  });
  it("Anchor forbids new targets but allows clearing one to baseline, then expires", () => {
    let state = fixture(
      ["target-24", "target-lock"],
      ["target-17", "destroy", "target-lock"],
    );
    state = play(state, "target-24").state;
    state = play(state, "target-lock").state;
    state = act(state, "Stay").state;
    expect(play(state, "target-17").state).toBe(state);
    const target = table(state, "target-24")[0];
    // Decommission's explicit target semantics are tested separately; destroy removes the latest lock first.
    const available = legalTrumpCommands(observeMatch(state, "ai").round);
    expect(available.length).toBeGreaterThan(0);
    expect(target.pointTarget).toBe(24);
    state = play(state, "destroy").state;
    state = play(state, "target-17").state;
    expect(state.round.pointTarget).toBe(17);
  });
  it("clearing a target under Anchor restores baseline and still forbids a replacement", () => {
    let state = fixture([
      "target-24",
      "target-lock",
      "decommission",
      "target-17",
    ]);
    state = play(state, "target-24").state;
    state = play(state, "target-lock").state;
    state = play(state, "decommission", {
      targetId: table(state, "target-24")[0].effectId,
    }).state;
    expect(state.round.pointTarget).toBe(21);
    expect(play(state, "target-17").state).toBe(state);
    state = act(state, "Stay").state;
    state = act(state, "Stay").state;
    expect(table(state, "target-lock")).toEqual([]);
    state = play(state, "target-17").state;
    expect(state.round.pointTarget).toBe(17);
  });
  it("Suppress pauses a target immediately and removing it resumes the same record", () => {
    let state = fixture(["target-24", "destroy"], ["suppress"]);
    state = play(state, "target-24").state;
    const targetId = table(state, "target-24")[0].effectId;
    state = act(state, "Stay").state;
    state = play(state, "suppress").state;
    expect(state.round.pointTarget).toBe(21);
    expect(table(state, "target-24")[0].effectId).toBe(targetId);
    state = act(state, "Stay").state;
    state = play(state, "destroy").state;
    expect(state.round.pointTarget).toBe(24);
    expect(table(state, "target-24")[0].effectId).toBe(targetId);
  });
  it("Suppress cannot target Suppress, follows its target's lifetime, and expires at the target Turn's end", () => {
    let state = fixture(
      ["pressure", "suppress", "decommission"],
      ["suppress", "shield"],
    );
    state = play(state, "pressure").state;
    state = act(state, "Stay").state;
    state = play(state, "suppress").state;
    state = play(state, "shield").state;
    state = act(state, "Stay").state;
    const suppressionId = table(state, "suppress")[0].effectId;
    const commands = legalTrumpCommands(observeMatch(state, "human").round);
    expect(
      commands
        .filter(
          (c) =>
            c.instanceId ===
            hand(state).find((c) => c.definitionId === "suppress")!.instanceId,
        )
        .map((c) => c.targetId),
    ).not.toContain(suppressionId);
    state = play(state, "decommission", {
      targetId: table(state, "pressure")[0].effectId,
    }).state;
    expect(table(state, "suppress")).toEqual([]);
    let expires = fixture(["pressure"], ["suppress"]);
    expires = play(expires, "pressure").state;
    expires = act(expires, "Stay").state;
    expires = play(expires, "suppress").state;
    expires = act(expires, "Stay").state;
    expires = act(expires, "Stay").state;
    expect(table(expires, "suppress")).toEqual([]);
  });
  it("a suppressed Reserve does not draw or spend a charge", () => {
    let state = fixture(["harvest", "shield"], ["suppress"]);
    state = play(state, "harvest").state;
    state = act(state, "Stay").state;
    state = play(state, "suppress").state;
    state = act(state, "Stay").state;
    const random = streams();
    state = play(state, "shield", {}, random).state;
    expect(table(state, "harvest")[0].remainingCharges).toBe(2);
    expect(random.trumpSelection).not.toHaveBeenCalled();
  });
  it("Heavy Hit draws two in order, Safe Hit protects only the first and gate runs once", () => {
    let state = fixture(["heavy-hit"], ["safe-hit"]);
    state = play(state, "heavy-hit").state;
    state = act(state, "Stay").state;
    state = play(state, "safe-hit").state;
    // AI has 17; draw 5 is unsafe and returns to bottom, then 6 is unprotected.
    const deck = state.round.deck,
      five = deck.find((c) => c.value === 5)!,
      six = deck.find((c) => c.value === 6)!;
    state = freezeData({
      ...state,
      round: {
        ...state.round,
        deck: [five, six, ...deck.filter((c) => c !== five && c !== six)],
      },
    });
    expect(observeMatch(state, "ai").round.hitDrawCounts.ai).toBe(2);
    const random = streams(),
      result = act(state, "Hit", random);
    ledger(result);
    expect(faces(result.state, "ai")).toEqual([8, 9, 6]);
    expect(result.state.round.deck.at(-1)).toBe(five);
    expect(table(result.state, "heavy-hit")).toEqual([]);
    expect(table(result.state, "safe-hit")).toEqual([]);
    expect(result.state.round.turn!.number).toBe(3);
    expect(random.trumpGate).toHaveBeenCalledTimes(1);
    expect(random.trumpSelection).toHaveBeenCalledTimes(1);
  });
  it("Safe Hit retains a safe card, ends the Turn and still grants normally", () => {
    let state = play(
      fixture(["safe-hit"], [], [1, 8, 2, 9, 3]),
      "safe-hit",
    ).state;
    const random = streams(),
      result = act(state, "Hit", random);
    ledger(result);
    expect(faces(result.state)).toEqual([1, 2, 3]);
    expect(table(result.state, "safe-hit")).toEqual([]);
    expect(random.trumpGate).toHaveBeenCalledTimes(1);
  });
  it("Supply Cache waits through a failed gate, then replaces one grant with at most two and leaves", () => {
    let state = play(fixture(["supply-cache"]), "supply-cache").state;
    const failed = streams();
    failed.trumpGate.mockReturnValue(0.9);
    state = act(state, "Hit", failed).state;
    expect(table(state, "supply-cache")).toHaveLength(1);
    state = act(state, "Stay").state;
    const random = streams(),
      result = act(state, "Hit", random);
    ledger(result);
    expect(table(result.state, "supply-cache")).toEqual([]);
    expect(hand(result.state)).toHaveLength(2);
    expect(random.trumpSelection).toHaveBeenCalledTimes(2);
    expect(random.trumpGate).toHaveBeenCalledTimes(1);
  });
  it("table exchange preserves charges and makes subsequent consumption benefit the new controller", () => {
    let state = fixture(
      ["pressure", "table-exchange", "shield"],
      ["harvest", "pressure"],
    );
    state = play(state, "pressure").state;
    state = act(state, "Stay").state;
    state = play(state, "harvest").state;
    state = play(state, "pressure").state;
    state = act(state, "Stay").state;
    const source = table(state, "harvest")[0];
    const random = streams();
    state = play(
      state,
      "table-exchange",
      {
        ownTargetId: table(state, "pressure").find((t) => t.owner === "human")!
          .effectId,
        targetId: source.effectId,
      },
      random,
    ).state;
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expect(table(state, "harvest")[0]).toMatchObject({
      effectId: source.effectId,
      sourceInstanceId: source.sourceInstanceId,
      owner: "human",
      remainingCharges: 1,
    });
    const result = play(state, "shield", {}, random);
    ledger(result);
    expect(table(result.state, "harvest")).toEqual([]);
    expect(random.trumpSelection).toHaveBeenCalledTimes(1);
  });
});

describe("cross-card edge cases", () => {
  it("a failed legal targeted draw still counts as Follow Suit's first consumed card", () => {
    let state = play(
      fixture(["bandwagon"], ["draw-2", "pressure"], [2, 8, 11, 9]),
      "bandwagon",
    ).state;
    state = act(state, "Stay").state;
    const failed = play(state, "draw-2");
    ledger(failed);
    expect(
      failed.events.find(
        (e) =>
          e.type === "round" &&
          e.event.type === "trump" &&
          e.event.effect === "draw",
      ),
    ).toMatchObject({ event: { card: null } });
    state = play(failed.state, "pressure").state;
    const result = act(state, "Stay");
    ledger(result);
    expect(hand(result.state).some((c) => c.definitionId === "draw-2")).toBe(
      true,
    );
  });
  it("Turn-start Follow Suit retrieval is eligible for the new Turn's Embargo exactly once", () => {
    let state = play(fixture(["bandwagon"], ["embargo"]), "bandwagon").state;
    state = act(state, "Stay").state;
    state = play(state, "embargo").state;
    const random = streams(),
      result = act(state, "Stay", random);
    ledger(result);
    expect(hand(result.state)).toEqual([]);
    expect(table(result.state, "bandwagon")).toEqual([]);
    expect(table(result.state, "embargo")).toEqual([]);
    expect(
      result.events.some(
        (e) =>
          e.type === "round" &&
          e.event.type === "resource" &&
          e.event.operation === "blocked",
      ),
    ).toBe(true);
    expect(random.trumpSelection).not.toHaveBeenCalled();
  });
  it("mixed supply fills the last slot before existing Reserve attempts its grant", () => {
    let state = fixture([
      "harvest",
      "pressure-supply",
      ...Array(6).fill("shield"),
    ]);
    state = play(state, "harvest").state;
    // A Hit fills the vacated slot, then the opponent returns control without changing this hand.
    state = act(state, "Hit").state;
    state = act(state, "Stay").state;
    expect(hand(state)).toHaveLength(8);
    const random = streams(),
      result = play(state, "pressure-supply", {}, random);
    ledger(result);
    expect(hand(result.state)).toHaveLength(8);
    expect(table(result.state, "pressure-supply")).toHaveLength(1);
    expect(table(result.state, "harvest")[0].remainingCharges).toBe(1);
    expect(random.trumpSelection).toHaveBeenCalledTimes(1);
  });
  it("capacity credits the actor's Suppress that actually leaves with a replaced opponent target", () => {
    let state = fixture(
      [...Array(4).fill("shield"), "suppress", "target-24"],
      ["target-17"],
    );
    for (let i = 0; i < 4; i++) state = play(state, "shield").state;
    state = act(state, "Stay").state;
    state = play(state, "target-17").state;
    state = act(state, "Stay").state;
    state = play(state, "suppress").state;
    expect(
      state.round.trumps!.table.filter((t) => t.owner === "human"),
    ).toHaveLength(5);
    const result = play(state, "target-24");
    ledger(result);
    expect(result.state).not.toBe(state);
    expect(result.state.round.pointTarget).toBe(24);
    expect(table(result.state, "suppress")).toEqual([]);
    expect(
      result.state.round.trumps!.table.filter((t) => t.owner === "human"),
    ).toHaveLength(5);
  });
  it("stacked Safe Hits cover the same first draw and stacked Caches still replace the grant with two", () => {
    let state = fixture(
      ["safe-hit", "safe-hit", "supply-cache", "supply-cache"],
      [],
      [1, 8, 2, 9, 3],
    );
    for (const id of ["safe-hit", "safe-hit", "supply-cache", "supply-cache"])
      state = play(state, id).state;
    const random = streams(),
      result = act(state, "Hit", random);
    ledger(result);
    expect(faces(result.state)).toEqual([1, 2, 3]);
    expect(hand(result.state)).toHaveLength(2);
    expect(table(result.state, "safe-hit")).toEqual([]);
    expect(table(result.state, "supply-cache")).toEqual([]);
    expect(random.trumpGate).toHaveBeenCalledTimes(1);
    expect(random.trumpSelection).toHaveBeenCalledTimes(2);
  });
  it("Heavy Hit expires on Stay, while zero or one remaining numbers never force an extra draw", () => {
    let state = play(fixture(["heavy-hit"]), "heavy-hit").state;
    state = act(state, "Stay").state;
    const stayed = act(state, "Stay");
    ledger(stayed);
    expect(table(stayed.state, "heavy-hit")).toEqual([]);
    // The exact affected Turn is over, so use a separate real heavy-Hit arrangement with one remaining card.
    let one = play(fixture(["heavy-hit"]), "heavy-hit").state;
    one = act(one, "Stay").state;
    const deck = one.round.deck,
      actor = "human";
    one = freezeData({
      ...one,
      round: {
        ...one.round,
        deck: deck.slice(-1),
        hands: {
          ...one.round.hands,
          [actor]: [...one.round.hands[actor], ...deck.slice(0, -1)],
        },
      },
    });
    const random = streams(),
      result = act(one, "Hit", random);
    ledger(result);
    expect(
      result.events.filter((e) => e.type === "round" && e.event.type === "hit"),
    ).toHaveLength(1);
    expect(random.trumpGate).toHaveBeenCalledTimes(1);
    const empty = result.state;
    expect(act(empty, "Hit").state).toBe(empty);
  });
});

describe("resource limits and direct deletion seams", () => {
  it("Full Guard does not stack and Open Hand rejects an already public hidden slot", () => {
    let state = play(
      fixture(["full-shield", "full-shield"]),
      "full-shield",
    ).state;
    expect(play(state, "full-shield").state).toBe(state);
    state = play(fixture(["reveal-self", "reveal-self"]), "reveal-self").state;
    expect(play(state, "reveal-self").state).toBe(state);
  });
  it.each(["full", "partial", "empty"])(
    "Supply Cache consumes once after a successful gate when stock/hand is %s",
    (mode) => {
      let state = fixture(
        ["supply-cache", ...(mode === "full" ? Array(7).fill("shield") : [])],
        [],
        undefined,
        mode === "empty" ? {} : { pressure: mode === "partial" ? 1 : 12 },
      );
      state = play(state, "supply-cache").state;
      const random = streams(),
        before = hand(state).length,
        result = act(state, "Hit", random);
      ledger(result);
      expect(table(result.state, "supply-cache")).toEqual([]);
      expect(hand(result.state)).toHaveLength(
        before + (mode === "empty" ? 0 : 1),
      );
      expect(random.trumpSelection).toHaveBeenCalledTimes(
        mode === "empty" ? 0 : 1,
      );
    },
  );
  it("non-card deletion removes the number's binding and its dependent Suppress together", () => {
    let state = fixture(["face-lighten"], ["suppress"]);
    state = play(state, "face-lighten").state;
    state = act(state, "Stay").state;
    state = play(state, "suppress").state;
    const round = deleteNumber(
      state.round,
      "human",
      state.round.hands.human[1].instanceId,
    );
    expect(round.trumps!.table).toEqual([]);
    expect(round.lastPlay).toBeNull();
    ledger({ state: freezeData({ ...state, round }), events: [] });
  });
});

// @req REQ-2026-024: control changes do not retarget or shorten an existing Suppress link.
describe("suppressed table exchange", () => {
  it("a transferred Reserve stays suppressed until the original target Turn expires", () => {
    let state = fixture(
      ["shield", "suppress", "table-exchange", "pressure", "shield"],
      ["harvest", "pressure"],
    );
    state = play(state, "shield").state;
    state = act(state, "Stay").state;
    state = play(state, "harvest").state;
    state = play(state, "pressure").state;
    state = act(state, "Stay").state;
    const reserve = table(state, "harvest")[0];
    state = play(state, "suppress", { targetId: reserve.effectId }).state;
    const suppression = table(state, "suppress")[0];
    const random = streams();
    state = play(
      state,
      "table-exchange",
      {
        ownTargetId: table(state, "shield")[0].effectId,
        targetId: reserve.effectId,
      },
      random,
    ).state;
    expect(table(state, "harvest")[0]).toMatchObject({
      effectId: reserve.effectId,
      sourceInstanceId: reserve.sourceInstanceId,
      owner: "human",
      remainingCharges: 1,
    });
    expect(table(state, "suppress")[0]).toEqual(suppression);
    expect(
      observeMatch(state, "human").round.trumps!.table.find(
        (t) => t.effectId === reserve.effectId,
      )!.suppressed,
    ).toBe(true);
    state = play(state, "pressure", {}, random).state;
    expect(table(state, "harvest")[0].remainingCharges).toBe(1);
    expect(random.trumpSelection).not.toHaveBeenCalled();
    state = act(state, "Stay", random).state;
    expect(state.round.turn!.number).toBe(suppression.expiresAfterTurn);
    state = act(state, "Stay", random).state;
    expect(table(state, "suppress")).toEqual([]);
    expect(
      observeMatch(state, "human").round.trumps!.table.find(
        (t) => t.effectId === reserve.effectId,
      )!.suppressed,
    ).not.toBe(true);
    const result = play(state, "shield", {}, random);
    ledger(result);
    expect(table(result.state, "harvest")).toEqual([]);
    expect(random.trumpSelection).toHaveBeenCalledTimes(1);
  });
});
