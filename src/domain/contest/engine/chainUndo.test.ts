// @req REQ-2026-024: capacity, inverse ordering, hidden costs and instance conservation.
import { describe, it, expect, vi } from "vitest";
import { freezeData } from "../immutable";
import {
  observeMatch,
  projectMatchTransition,
  legalTrumpCommands,
  legalMatchActions,
  drawTrump,
} from "./index";
import type { MatchState, MatchTransition } from "./index";
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
function withoutPrivateData(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    expect([
      "deck",
      "deltas",
      "costIds",
      "stock",
      "nextGeneratedId",
      "nextEffectId",
      "deletedNumbers",
      "trumpSetup",
      "scry",
      "deckRevision",
    ]).not.toContain(key);
    // rules.resources.stock is public initial configuration, so inspected separately below.
    withoutPrivateData(child);
  }
}
function privateSwap(state: MatchState, definition: string): MatchState {
  const t = state.round.trumps!,
    own = [...t.hands.human],
    stock = [...t.stock.human];
  const index = stock.findIndex((c) => c.definitionId === definition);
  [own[1], stock[index]] = [stock[index], own[1]];
  return freezeData({
    ...state,
    round: {
      ...state.round,
      trumps: {
        ...t,
        hands: { ...t.hands, human: own },
        stock: { ...t.stock, human: stock },
      },
    },
  });
}
function viewWithoutRules(result: MatchTransition) {
  const projected = projectMatchTransition(result, "ai");
  const clone = JSON.parse(
    JSON.stringify(projected, (key, value) =>
      key === "rules" ? undefined : value,
    ),
  );
  withoutPrivateData(clone);
  return projected;
}
describe("cost privacy and stock deletion", () => {
  it.each(["resource-swap", "purge-hand"])(
    "%s hides cost identities in every observation, event, legal action and later undo",
    (id) => {
      const original = fixture(
        [id, "shield", ...(id === "purge-hand" ? ["pressure"] : [])],
        ["regret", "shield"],
      );
      const variant = privateSwap(original, "pressure");
      expect(observeMatch(original, "ai")).toEqual(observeMatch(variant, "ai"));
      const randomA = streams(),
        randomB = streams();
      randomA.trumpSelection.mockReturnValue(0.99);
      randomB.trumpSelection.mockReturnValue(0.99);
      const a = play(original, id, {}, randomA),
        b = play(variant, id, {}, randomB);
      ledger(a);
      ledger(b);
      expect(viewWithoutRules(a)).toEqual(viewWithoutRules(b));
      expect(a.state.round.turn).toEqual({
        player: "human",
        number: 1,
        usedTrump: true,
      });
      expect(a.state.round.quietStays).toBe(0);
      const x = act(a.state, "Stay"),
        y = act(b.state, "Stay");
      expect(viewWithoutRules(x)).toEqual(viewWithoutRules(y));
      expect(legalTrumpCommands(observeMatch(x.state, "ai").round)).toEqual(
        legalTrumpCommands(observeMatch(y.state, "ai").round),
      );
      expect(legalMatchActions(observeMatch(x.state, "ai"))).toEqual(
        legalMatchActions(observeMatch(y.state, "ai")),
      );
      const undoA = play(x.state, "regret"),
        undoB = play(y.state, "regret");
      ledger(undoA);
      ledger(undoB);
      expect(viewWithoutRules(undoA)).toEqual(viewWithoutRules(undoB));
      const privateCostsA = a.state.round
        .trumps!.destroyed.filter((d) => d.reason === "cost")
        .map((d) => d.instance.definitionId);
      const privateCostsB = b.state.round
        .trumps!.destroyed.filter((d) => d.reason === "cost")
        .map((d) => d.instance.definitionId);
      expect(privateCostsA).not.toEqual(privateCostsB);
      expect(
        observeMatch(a.state, "human").round.trumps!.destroyed.every(
          (d) => d.instance !== null,
        ),
      ).toBe(true);
      expect(
        observeMatch(a.state, "ai")
          .round.trumps!.destroyed.filter((d) => d.reason === "cost")
          .every((d) => d.instance === null),
      ).toBe(true);
    },
  );
  it("Cut Supply declares every rule definition without probing hidden stock and publishes a legal miss", () => {
    let state = fixture(["banish-copy"], ["shield"]),
      variant = state;
    const old = variant.round.trumps!,
      pressure = old.stock.ai.find((c) => c.definitionId === "pressure")!;
    // Same counts and initial public rules, different privately remaining definition.
    const swapped = [...old.stock.ai],
      i = swapped.indexOf(pressure),
      own = [...old.hands.ai];
    [swapped[i], own[0]] = [own[0], swapped[i]];
    variant = freezeData({
      ...variant,
      round: {
        ...variant.round,
        trumps: {
          ...old,
          stock: { ...old.stock, ai: swapped },
          hands: { ...old.hands, ai: own },
        },
      },
    });
    expect(legalTrumpCommands(observeMatch(state, "human").round)).toEqual(
      legalTrumpCommands(observeMatch(variant, "human").round),
    );
    const random = streams(),
      result = play(state, "banish-copy", { definitionId: "safe-hit" }, random);
    ledger(result);
    expect(result.state).not.toBe(state);
    expect(
      projectMatchTransition(result, "ai").events.find(
        (e) => e.type === "round" && e.event.type === "resource",
      ),
    ).toMatchObject({
      event: { definitionId: "safe-hit", instance: null, operation: "delete" },
    });
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expect(
      play(state, "banish-copy", { definitionId: "not-a-definition" }).state,
    ).toBe(state);
  });
  it("undoing Cut Supply creates a generated stock instance, then undoing that removes it without touching hand capacity", () => {
    let state = fixture(
      ["banish-copy", "regret", "regret"],
      Array(8).fill("shield"),
    );
    const old = state.round.trumps!.stock.ai.find(
      (c) => c.definitionId === "pressure",
    )!;
    const before = state.round.trumps!.stock.ai.length;
    let result = play(state, "banish-copy", { definitionId: "pressure" });
    ledger(result);
    state = result.state;
    expect(state.round.trumps!.stock.ai).toHaveLength(before - 1);
    expect(
      state.round.trumps!.destroyed.find(
        (d) => d.instance.instanceId === old.instanceId,
      ),
    ).toMatchObject({ reason: "deleted", public: true });
    result = play(state, "regret");
    ledger(result);
    state = result.state;
    const generated = state.round.trumps!.stock.ai.find(
      (c) => c.origin.type === "generated",
    )!;
    expect(generated).toMatchObject({
      definitionId: "pressure",
      origin: { type: "generated" },
    });
    expect(generated.instanceId).not.toBe(old.instanceId);
    expect(hand(state, "ai")).toHaveLength(8);
    expect(state.round.trumps!.stock.ai).toHaveLength(before);
    result = play(state, "regret");
    ledger(result);
    expect(result.state.round.trumps!.stock.ai).toHaveLength(before - 1);
    expect(
      result.state.round.trumps!.destroyed.some(
        (d) => d.instance.instanceId === generated.instanceId,
      ),
    ).toBe(true);
    expect(
      result.state.round.trumps!.stock.ai.some(
        (c) => c.instanceId === old.instanceId,
      ),
    ).toBe(false);
  });
});

describe("Regret after mixed grants and trigger changes", () => {
  const scenarios = ["shared-supply", "pressure-supply", "life-trade"];
  it.each(
    scenarios.flatMap((supply) =>
      [7, 8].flatMap((own) =>
        [7, 8].flatMap((other) =>
          [false, true].map((reserve) => ({ supply, own, other, reserve })),
        ),
      ),
    ),
  )(
    "$supply -> Regret -> Regret, hand $own/$other, Reserve $reserve",
    ({ supply, own, other, reserve }) => {
      let state = fixture(
        [
          ...(reserve ? ["harvest"] : []),
          supply,
          "regret",
          "regret",
          ...Array(own - 3 - (reserve ? 1 : 0)).fill("shield"),
        ],
        Array(other).fill("shield"),
      );
      if (reserve) state = play(state, "harvest").state;
      const random = streams();
      for (const id of [supply, "regret", "regret"]) {
        const before = state,
          result = play(state, id, {}, random);
        ledger(result);
        expect(result.state).not.toBe(before);
        state = result.state;
        expect(hand(state).length).toBeLessThanOrEqual(8);
        expect(hand(state, "ai").length).toBeLessThanOrEqual(8);
      }
      expect(random.numbers).not.toHaveBeenCalled();
      expect(random.trumpGate).not.toHaveBeenCalled();
    },
  );
  it.each(["shared-supply", "pressure-supply", "life-trade", "purge-hand"])(
    "the opponent can undo and re-undo %s at full capacity",
    (id) => {
      let state = fixture(
        [id, ...Array(7).fill("shield")],
        ["regret", "regret", ...Array(6).fill("shield")],
      );
      let result = play(state, id);
      ledger(result);
      state = act(result.state, "Stay").state;
      for (let i = 0; i < 2; i++) {
        result = play(state, "regret");
        ledger(result);
        expect(result.state).not.toBe(state);
        state = result.state;
      }
      expect(hand(state, "ai").length).toBeLessThanOrEqual(8);
      expect(
        state.round.trumps!.destroyed.filter((d) => d.reason === "cost"),
      ).toHaveLength(id === "purge-hand" ? 7 : 0);
    },
  );
  it("a capacity-incompatible inverse is publicly rejected before any payment, event or RNG", () => {
    let state = fixture(
      ["shared-supply", "regret", "regret"],
      Array(7).fill("shield"),
    );
    state = play(state, "shared-supply").state;
    state = play(state, "regret").state;
    // A controlled non-card fixture mutation tests the guard even if a future integration retains the window.
    const drawn = drawTrump(state.round.trumps!, "ai", () => 0);
    state = freezeData({
      ...state,
      round: { ...state.round, trumps: drawn.state },
    });
    expect(hand(state, "ai")).toHaveLength(8);
    const card = hand(state).find((c) => c.definitionId === "regret")!;
    expect(
      legalTrumpCommands(observeMatch(state, "human").round).some(
        (c) => c.instanceId === card.instanceId,
      ),
    ).toBe(false);
    const random = streams(),
      result = play(state, "regret", {}, random);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expect(random.trumpGate).not.toHaveBeenCalled();
  });
  it("undo restores consumed Reserve charges and reuses the old record only when it survived", () => {
    let state = fixture(["harvest", "shield", "regret", "regret"]);
    state = play(state, "harvest").state;
    const old = table(state, "harvest")[0].effectId;
    state = play(state, "shield").state;
    expect(table(state, "harvest")[0].remainingCharges).toBe(1);
    let result = play(state, "regret");
    ledger(result);
    state = result.state;
    // Reverse the last charge/grant, then this legal Regret consumes one charge itself.
    expect(table(state, "harvest")[0]).toMatchObject({
      effectId: old,
      remainingCharges: 1,
    });
    result = play(state, "regret");
    ledger(result);
    expect(table(result.state, "harvest")).toEqual([]);
  });
  it("undo of exhausted Reserve creates a fresh record, which does not trigger on its own restoration", () => {
    let state = fixture(["harvest", "shield", "shield", "regret"]);
    state = play(state, "harvest").state;
    const old = table(state, "harvest")[0].effectId;
    state = play(state, "shield").state;
    state = play(state, "shield").state;
    expect(table(state, "harvest")).toEqual([]);
    const random = streams(),
      result = play(state, "regret", {}, random);
    ledger(result);
    expect(table(result.state, "harvest")[0].effectId).not.toBe(old);
    expect(table(result.state, "harvest")[0].remainingCharges).toBe(1);
    expect(random.trumpSelection).not.toHaveBeenCalled();
  });
  it("undo restores a removed target before remapping its dependent suppression", () => {
    let state = fixture(
      ["target-24", "decommission", "regret", "regret"],
      ["suppress"],
    );
    state = play(state, "target-24").state;
    state = act(state, "Stay").state;
    state = play(state, "suppress").state;
    state = act(state, "Stay").state;
    const oldTarget = table(state, "target-24")[0].effectId,
      oldSuppress = table(state, "suppress")[0].effectId;
    state = play(state, "decommission", { targetId: oldTarget }).state;
    expect(table(state, "suppress")).toEqual([]);
    let result = play(state, "regret");
    ledger(result);
    state = result.state;
    const restored = table(state, "target-24")[0],
      suppression = table(state, "suppress")[0];
    expect(restored.effectId).not.toBe(oldTarget);
    expect(suppression.effectId).not.toBe(oldSuppress);
    expect(suppression.targetEffectId).toBe(restored.effectId);
    expect(state.round.pointTarget).toBe(21);
    result = play(state, "regret");
    ledger(result);
    expect(table(result.state, "target-24")).toEqual([]);
    expect(table(result.state, "suppress")).toEqual([]);
  });
  it("a Turn boundary that processes a pending grant closes the previous trump undo window", () => {
    let state = fixture(["bandwagon", "regret"], ["pressure"]);
    state = play(state, "bandwagon").state;
    state = act(state, "Stay").state;
    state = play(state, "pressure").state;
    state = act(state, "Stay").state;
    expect(state.round.lastPlay).toBeNull();
    expect(play(state, "regret").state).toBe(state);
  });
  it("Round cleanup cancels finite triggers and locks, retains resources, and never grants on settlement", () => {
    let state = fixture(["harvest", "bandwagon", "hush", "supply-cache"], []);
    for (const id of ["harvest", "bandwagon", "hush", "supply-cache"])
      state = play(state, id).state;
    const random = streams(),
      result = finish(state, random);
    ledger(result);
    expect(result.state.round.trumps!.table).toEqual([]);
    expect(result.state.round.lastPlay).toBeNull();
    expect(random.trumpSelection).not.toHaveBeenCalled();
    expect(hand(result.state).length).toBeGreaterThan(0);
  });
  it("legal repeated supply commands are not stopped by a hidden per-Turn play cap", () => {
    let state = fixture(Array(8).fill("shared-supply"), [], undefined, {
      "shared-supply": 20,
    });
    const random = streams();
    for (let i = 0; i < 28; i++) {
      const result = play(state, "shared-supply", {}, random);
      ledger(result);
      expect(result.state).not.toBe(state);
      expect(result.events.length).toBeLessThanOrEqual(3);
      state = result.state;
    }
    expect(hand(state)).toEqual([]);
    expect(state.round.turn!.number).toBe(1);
    expect(state.round.trumps!.stock.human).toEqual([]);
    state = act(state, "Stay").state;
    expect(state.round.turn!.player).toBe("ai");
  });
});

// @req REQ-2026-024: replay frames carry the exact transaction prefix, including automatic triggers.
describe("per-frame transaction consistency", () => {
  it.each([false, true])(
    "Reserve charge/grant/removal frames record only completed mutations, exhausts $0",
    (exhausts) => {
      let state = fixture(["harvest", "shield", "shield"]);
      state = play(state, "harvest").state;
      if (exhausts) state = play(state, "shield").state;
      const reserve = table(state, "harvest")[0];
      const result = play(state, "shield");
      ledger(result);
      let updated = false,
        grantCount = 0,
        removed = false;
      for (const event of result.events) {
        if (event.type !== "round") continue;
        const frame = event.event,
          tx = frame.state.lastPlay;
        if (tx?.type !== "trump") throw new Error("Missing frame transaction");
        if (
          frame.type === "table-effect" &&
          frame.effectId === reserve.effectId
        ) {
          if (frame.operation === "updated") updated = true;
          if (frame.operation === "removed") removed = true;
        }
        if (
          frame.type === "resource" &&
          frame.operation === "draw" &&
          frame.instance
        )
          grantCount++;
        expect(
          tx.deltas.filter((d) => d.type === "effect-updated"),
        ).toHaveLength(updated ? 1 : 0);
        expect(
          tx.deltas.filter((d) => d.type === "trump-granted"),
        ).toHaveLength(grantCount);
        expect(
          tx.deltas.some(
            (d) =>
              d.type === "effect-removed" && d.effectId === reserve.effectId,
          ),
        ).toBe(removed);
        if (updated && !removed)
          expect(
            frame.state.trumps!.table.find(
              (t) => t.effectId === reserve.effectId,
            )!.remainingCharges,
          ).toBe(reserve.remainingCharges! - 1);
        expect(Object.isFrozen(tx.deltas)).toBe(true);
      }
      expect(updated).toBe(true);
      expect(grantCount).toBe(1);
      expect(removed).toBe(exhausts);
    },
  );
  it("two Follow Suit records update their transactions in placement order", () => {
    let state = fixture(["bandwagon", "bandwagon"], ["shield"]);
    state = play(state, "bandwagon").state;
    state = play(state, "bandwagon").state;
    state = act(state, "Stay").state;
    const ids = table(state, "bandwagon").map((t) => t.effectId),
      result = play(state, "shield");
    ledger(result);
    const updated: string[] = [];
    for (const event of result.events) {
      if (event.type !== "round") continue;
      const frame = event.event,
        tx = frame.state.lastPlay;
      if (tx?.type !== "trump") throw new Error("Missing frame transaction");
      if (
        frame.type === "table-effect" &&
        frame.operation === "updated" &&
        ids.includes(frame.effectId)
      )
        updated.push(frame.effectId);
      expect(
        tx.deltas
          .filter((d) => d.type === "effect-updated")
          .map((d) => d.after.effectId),
      ).toEqual(updated);
      expect(
        frame.state
          .trumps!.table.filter(
            (t) =>
              ids.includes(t.effectId) && t.copiedDefinitionId === "shield",
          )
          .map((t) => t.effectId),
      ).toEqual(updated);
    }
    expect(updated).toEqual(ids);
  });
  it("Refit records each granted identity when that card actually enters the hand", () => {
    const result = play(fixture(["resource-swap", "shield"]), "resource-swap");
    ledger(result);
    const granted: string[] = [];
    for (const event of result.events) {
      if (event.type !== "round") continue;
      const frame = event.event,
        tx = frame.state.lastPlay;
      if (tx?.type !== "trump") throw new Error("Missing frame transaction");
      if (
        frame.type === "resource" &&
        frame.operation === "draw" &&
        frame.instance
      )
        granted.push(frame.instance.instanceId);
      expect(
        tx.deltas
          .filter((d) => d.type === "trump-granted")
          .map((d) => d.instanceId),
      ).toEqual(granted);
      expect(frame.state.trumps!.hands.human.map((c) => c.instanceId)).toEqual(
        granted,
      );
    }
    expect(granted).toHaveLength(2);
  });
  it("a blocked Reserve grant records the Embargo removal before publishing its resource frame", () => {
    let state = fixture(["embargo"], ["harvest", "shield"]);
    state = play(state, "embargo").state;
    const embargoId = table(state, "embargo")[0].effectId;
    state = act(state, "Stay").state;
    state = play(state, "harvest").state;
    const result = play(state, "shield");
    ledger(result);
    let blocked = false;
    for (const event of result.events) {
      if (event.type !== "round") continue;
      const frame = event.event,
        tx = frame.state.lastPlay;
      if (tx?.type !== "trump") throw new Error("Missing frame transaction");
      if (frame.type === "resource" && frame.operation === "blocked")
        blocked = true;
      expect(
        tx.deltas.some(
          (d) => d.type === "effect-removed" && d.effectId === embargoId,
        ),
      ).toBe(blocked);
      expect(
        frame.state.trumps!.table.some((t) => t.effectId === embargoId),
      ).toBe(!blocked);
      expect(tx.deltas.some((d) => d.type === "trump-granted")).toBe(false);
    }
    expect(blocked).toBe(true);
  });
});
