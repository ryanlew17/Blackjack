// @req REQ-2026-023: per-card authority, contribution, public legality and projection evidence.
import { describe, expect, it, vi } from "vitest";
import source from "../../../../docs/requirements/archive/REQ-2026-021-contest-trump-rule-contract.md?raw";
import { NUMBER_TRUMP_DEFINITIONS } from "../trumps/numberDefinitions";
import {
  createMatch,
  observeMatch,
  projectMatchTransition,
  legalTrumpCommands,
  transitionMatch,
  deleteNumber,
} from "./index";
import type { MatchState, MatchTransition } from "./index";
import { freezeData } from "../immutable";
import {
  numericFixture as fixture,
  numericPlay as play,
  numericAct as act,
  numericFinish as finish,
  emptyNumbers,
  values,
} from "./numberEffectTestHelpers";

function ledger(result: MatchTransition) {
  for (const state of [result.state, ...result.events.map((e) => e.state)]) {
    const r = state.round;
    const cards = [
      ...r.hands.human,
      ...r.hands.ai,
      ...r.deck,
      ...r.deletedNumbers,
    ];
    expect(new Set(cards.map((c) => c.instanceId)).size).toBe(cards.length);
    expect(cards.filter((c) => c.origin.type === "initial")).toHaveLength(11);
    expect(cards.filter((c) => c.origin.type === "generated")).toHaveLength(
      r.nextNumberId - 1,
    );
    for (const record of r.trumps!.table) {
      expect(
        r.trumps!.destroyed.some(
          (d) => d.instance.instanceId === record.sourceInstanceId,
        ),
      ).toBe(true);
      if (record.cardId)
        expect(
          [...r.hands.human, ...r.hands.ai].some(
            (c) => c.instanceId === record.cardId,
          ),
        ).toBe(true);
    }
    expect(Object.isFrozen(state)).toBe(true);
  }
}
function commandIDs(state: MatchState, definitionId: string) {
  const player = state.round.turn!.player;
  const card = state.round.trumps!.hands[player].find(
    (c) => c.definitionId === definitionId,
  )!;
  return legalTrumpCommands(observeMatch(state, player).round).filter(
    (c) => c.instanceId === card.instanceId,
  );
}
function opposingTable(human: readonly string[], ai: readonly string[]) {
  let s = fixture(human, ai);
  s = act(s, "Stay").state;
  for (const id of ai) s = play(s, id).state;
  return act(s, "Stay").state;
}
describe("all REQ-023 definitions", () => {
  it("implements exactly the 28 assigned original definitions plus Regret, with immutable data", () => {
    const rows = source
      .split("\n")
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim()),
      )
      .filter(
        (c) =>
          c.length === 7 &&
          /^\x60[^\x60]+\x60$/.test(c[0]) &&
          c[6] === "REQ-023",
      );
    const expected = [...rows.map((c) => c[0].slice(1, -1)), "regret"].sort();
    expect(Object.keys(NUMBER_TRUMP_DEFINITIONS).sort()).toEqual(expected);
    expect(expected).toHaveLength(29);
    expect(Object.isFrozen(NUMBER_TRUMP_DEFINITIONS)).toBe(true);
  });
  it.each([2, 3, 4, 5, 6, 7] as const)(
    "draw-%s takes the actual matching instance and does not yield Turn",
    (n) => {
      const original = fixture(["draw-" + n]);
      const found = original.round.deck.find((c) => c.value === n)!;
      const result = play(original, "draw-" + n);
      ledger(result);
      expect(result.state.round.hands.human.at(-1)).toBe(found);
      expect(result.state.round.deck).not.toContain(found);
      expect(result.state.round.turn).toEqual({
        player: "human",
        number: 1,
        usedTrump: true,
      });
      expect(result.state.round.quietStays).toBe(0);
      expect(result.state.round.trumps!.destroyed[0]).toMatchObject({
        reason: "played",
        instance: { definitionId: "draw-" + n },
      });
    },
  );
  it.each([2, 3, 4, 5, 6, 7] as const)(
    "draw-%s consumes on a hidden miss without changing public preflight legality",
    (n) => {
      const a = fixture(["draw-" + n], [], [10, n, 11, 9]);
      const replacement = n === 7 ? 8 : 7;
      const b = fixture(["draw-" + n], [], [10, replacement, 11, 9]);
      expect(observeMatch(a, "human")).toEqual(observeMatch(b, "human"));
      expect(commandIDs(a, "draw-" + n)).toEqual(commandIDs(b, "draw-" + n));
      const failed = play(a, "draw-" + n);
      ledger(failed);
      expect(values(failed.state, "human")).toEqual([10, 11]);
      expect(failed.state.round.turn!.usedTrump).toBe(true);
      expect(
        failed.events.filter((e) => e.type === "round").at(-1),
      ).toMatchObject({ event: { effect: "draw", card: null } });
    },
  );
  it("returns each side's last face-up instance to the tail and swaps actual instances", () => {
    let s = fixture(["return", "remove", "exchange"]);
    const original = s.round.hands;
    const swap = play(s, "exchange");
    ledger(swap);
    expect(swap.state.round.hands.human[1]).toBe(original.ai[1]);
    expect(swap.state.round.hands.ai[1]).toBe(original.human[1]);
    expect(swap.state.round.hands.human[0]).toBe(original.human[0]);
    s = play(swap.state, "return").state;
    expect(s.round.deck.at(-1)).toBe(original.ai[1]);
    const removed = play(s, "remove");
    ledger(removed);
    expect(removed.state.round.deck.at(-1)).toBe(original.human[1]);
    expect(values(removed.state, "human")).toEqual([10]);
    expect(values(removed.state, "ai")).toEqual([8]);
    expect(commandIDs(removed.state, "exchange")).toEqual([]);
  });
  it.each([17, 24, 27])(
    "installs target-%s and keeps 21/bust decisions active",
    (target) => {
      const s = fixture(["target-" + target]);
      const result = play(s, "target-" + target);
      ledger(result);
      expect(result.state.round.pointTarget).toBe(target);
      expect(result.state.round.phase).toBe("acting");
      const final = finish(result.state);
      expect(final.round.result!.pointTarget).toBe(target);
      expect(final.round.pointTarget).toBe(21);
    },
  );
  it("destroys the latest opposing record, while Sweep clears all and never reverses onPlay", () => {
    for (const id of ["destroy", "destroy-all"]) {
      const s = opposingTable(
        [id],
        ["target-17", "pressure-supply", "harvest"],
      );
      const before = s.round.hands.ai;
      const result = play(s, id);
      ledger(result);
      expect(result.state.round.hands.ai).toBe(before);
      expect(result.state.round.trumps!.table).toHaveLength(
        id === "destroy" ? 2 : 0,
      );
      expect(result.state.round.pointTarget).toBe(id === "destroy" ? 17 : 21);
      expect(
        result.state.round.trumps!.destroyed.filter((d) => d.owner === "ai"),
      ).toHaveLength(3);
    }
    const s = fixture(["destroy", "destroy-all"]);
    for (const id of ["destroy", "destroy-all"])
      expect(play(s, id).state).toBe(s);
  });
  it("Best Draw uses current effective total: highest safe, otherwise lowest, and allows an empty failure", () => {
    const a = play(fixture(["best-draw"], [], [10, 4, 3, 5]), "best-draw");
    expect(values(a.state, "human")).toEqual([10, 3, 8]);
    const b = play(fixture(["best-draw"]), "best-draw");
    expect(values(b.state, "human")).toEqual([10, 11, 1]);
    const empty = emptyNumbers(fixture(["best-draw"]));
    const failed = play(empty, "best-draw");
    ledger(failed);
    expect(failed.state.round.deck).toEqual([]);
    expect(failed.state.round.hands).toBe(empty.round.hands);
    expect(failed.state.round.turn!.usedTrump).toBe(true);
  });
  it("Forced Draw uses a public nonempty precondition, grants no Hit resource and keeps the actor", () => {
    const s = fixture(["forced-draw"], [], [10, 8, 11, 9, 6]);
    const result = play(s, "forced-draw");
    ledger(result);
    expect(values(result.state, "ai")).toEqual([8, 9, 6]);
    expect(result.state.round.turn!.player).toBe("human");
    const empty = emptyNumbers(fixture(["forced-draw"]));
    expect(play(empty, "forced-draw").state).toBe(empty);
  });
  it("Redraw returns before drawing, so an initially empty pile can redraw that same instance", () => {
    const s = emptyNumbers(fixture(["redraw"]));
    const card = s.round.hands.human.at(-1)!;
    const result = play(s, "redraw");
    ledger(result);
    expect(result.state.round.deck).toEqual([]);
    expect(result.state.round.hands.human.at(-1)).toBe(card);
    expect(result.state.round.deckRevision).toBe(s.round.deckRevision + 2);
    const effects = result.events.flatMap((e) =>
      e.type === "round" && e.event.type === "trump" ? [e.event.effect] : [],
    );
    expect(effects).toEqual(["played", "return", "draw"]);
  });
  it("Trim returns all raw >=8 face-ups left-to-right without touching the logical hidden slot", () => {
    let s = fixture(["trim"], [], [1, 3, 8, 4, 9, 10, 11]);
    for (let i = 0; i < 3; i++) {
      s = act(s, "Hit").state;
      s = act(s, "Stay").state;
    }
    const result = play(s, "trim");
    ledger(result);
    expect(values(result.state, "human")).toEqual([1]);
    expect(result.state.round.deck.slice(-4).map((c) => c.value)).toEqual([
      8, 9, 10, 11,
    ]);
    expect(
      play(fixture(["trim"], [], [10, 8, 2, 9]), "trim").state.round.trumps!
        .hands.human,
    ).toHaveLength(1);
  });
});
describe("contributions, logical slots and persistent records", () => {
  it("applies hidden multiplier immediately once, while exposing no unknown total/increment", () => {
    let s = fixture(["double-hidden", "double-hidden"], ["normalize"]);
    s = play(s, "double-hidden").state;
    expect(s.round.hiddenMultipliers.ai).toBe(2);
    expect(observeMatch(s, "human").round.hands.ai.total).toBeNull();
    expect(observeMatch(s, "human").round.hands.ai.visibleTotal).toBe(9);
    expect(observeMatch(s, "ai").round.hands.ai.total).toBe(25);
    s = play(s, "double-hidden").state;
    expect(s.round.hiddenMultipliers.ai).toBe(2);
    s = act(s, "Stay").state;
    const restored = play(s, "normalize");
    ledger(restored);
    expect(restored.state.round.hiddenMultipliers.ai).toBe(1);
    expect(observeMatch(restored.state, "ai").round.hands.ai.total).toBe(17);
    expect(
      play(fixture(["normalize"]), "normalize").state.round.trumps!.hands.human,
    ).toHaveLength(1);
  });
  it("Symbiosis changes both final hidden contributions simultaneously, preserving final totals after cleanup", () => {
    let s = fixture(["symbiosis", "double-hidden"]);
    s = play(s, "double-hidden").state;
    s = play(s, "symbiosis").state;
    expect(observeMatch(s, "human").round.hands.human.total).toBe(21);
    expect(observeMatch(s, "human").round.hands.ai.total).toBeNull();
    const final = finish(s);
    expect(final.round.result).toMatchObject({
      totals: { human: 37, ai: 35 },
      winner: "ai",
    });
    expect(observeMatch(final, "human").round.hands.human.total).toBe(37);
    expect(observeMatch(final, "human").round.hands.ai.total).toBe(35);
    expect(final.round.hiddenMultipliers).toEqual({ human: 1, ai: 1 });
    expect(final.round.trumps!.table).toEqual([]);
  });
  it("replaces global Symbiosis, and clearing it cancels only the pending shared contribution", () => {
    let s = fixture(["symbiosis"], ["symbiosis", "destroy-all"]);
    s = play(s, "symbiosis").state;
    s = act(s, "Stay").state;
    s = play(s, "symbiosis").state;
    expect(
      s.round.trumps!.table.filter((t) => t.kind === "symbiosis"),
    ).toHaveLength(1);
    expect(s.round.trumps!.table[0].owner).toBe("ai");
    // The AI cannot Sweep its own record.
    expect(play(s, "destroy-all").state).toBe(s);
    s = act(s, "Stay").state;
    const final = finish(s);
    expect(final.round.result!.totals).toEqual({ human: 29, ai: 27 });
  });
  it("Expose publishes the original hidden value but never turns that logical slot into a movable face-up", () => {
    let s = fixture(
      ["reveal-opponent", "double-hidden"],
      ["return", "exchange"],
    );
    s = play(s, "reveal-opponent").state;
    expect(observeMatch(s, "human").round.hands.ai.cards[0]).toEqual({
      value: 8,
      faceDown: false,
    });
    expect(observeMatch(s, "human").round.hands.ai.total).toBe(17);
    s = play(s, "double-hidden").state;
    expect(observeMatch(s, "human").round.hands.ai.total).toBe(25);
    s = act(s, "Stay").state;
    s = play(s, "return").state;
    expect(values(s, "ai")).toEqual([8]);
    expect(commandIDs(s, "exchange")).toEqual([]);
    expect(s.round.hiddenCards.ai).toBe(s.round.hands.ai[0].instanceId);
  });
  it("clamps face modifiers after summing, regardless of installation order", () => {
    function scenario(first: boolean) {
      let s = fixture(["face-lighten"], ["face-burden"], [1, 4, 2, 5]);
      if (first) {
        s = play(s, "face-lighten").state;
        s = act(s, "Stay").state;
        s = play(s, "face-burden").state;
      } else {
        s = act(s, "Stay").state;
        s = play(s, "face-burden").state;
        s = act(s, "Stay").state;
        s = play(s, "face-lighten").state;
      }
      return s;
    }
    for (const order of [true, false]) {
      const s = scenario(order);
      expect(observeMatch(s, "human").round.hands.human.total).toBe(3);
      expect(observeMatch(s, "ai").round.hands.human.visibleTotal).toBe(2);
      expect(values(s, "human")).toEqual([1, 2]);
    }
    const lowered = play(
      fixture(["face-lighten"], [], [1, 4, 2, 5]),
      "face-lighten",
    ).state;
    expect(observeMatch(lowered, "human").round.hands.human.total).toBe(2);
  });
  it("bindings follow actual swapped cards, retain controller, and disappear when their card returns", () => {
    let s = fixture(["face-lighten", "face-burden", "exchange", "return"]);
    s = play(s, "face-lighten").state;
    s = play(s, "face-burden").state;
    const swap = play(s, "exchange");
    ledger(swap);
    s = swap.state;
    expect(observeMatch(s, "human").round.hands.human.total).toBe(21);
    expect(observeMatch(s, "ai").round.hands.ai.total).toBe(17);
    expect(s.round.trumps!.table.every((t) => t.owner === "human")).toBe(true);
    const returned = play(s, "return");
    ledger(returned);
    expect(returned.state.round.trumps!.table.map((t) => t.kind)).toEqual([
      "face-lighten",
    ]);
  });
  it.each(["face-lighten", "face-burden"] as const)(
    "%s rejects hidden and duplicate bindings without consumption",
    (id) => {
      let s = fixture([id, id]);
      const hidden =
        s.round.hiddenCards[id === "face-lighten" ? "human" : "ai"]!;
      expect(play(s, id, { targetId: hidden }).state).toBe(s);
      s = play(s, id).state;
      expect(play(s, id).state).toBe(s);
    },
  );
  it("Resonance snapshots non-hidden face-up count and participates in global target replacement", () => {
    let s = fixture(["target-17", "resonance", "draw-2", "resonance"]);
    s = play(s, "target-17").state;
    s = play(s, "resonance").state;
    expect(s.round.pointTarget).toBe(23);
    s = play(s, "draw-2").state;
    expect(s.round.pointTarget).toBe(23);
    s = play(s, "resonance").state;
    expect(s.round.pointTarget).toBe(24);
    expect(
      s.round.trumps!.table.filter((t) => t.pointTarget !== null),
    ).toHaveLength(1);
  });
  it("Table Exchange preserves identities/charges and cannot select global, bound or lock records", () => {
    let s = fixture(
      ["pressure-supply", "symbiosis", "face-lighten", "table-exchange"],
      ["harvest", "hush"],
    );
    s = play(s, "pressure-supply").state;
    s = play(s, "symbiosis").state;
    s = play(s, "face-lighten").state;
    s = act(s, "Stay").state;
    s = play(s, "harvest").state;
    s = play(s, "hush").state;
    s = act(s, "Stay").state;
    const before = s.round.hands;
    const cmds = commandIDs(s, "table-exchange");
    expect(cmds).toHaveLength(1);
    const a = s.round.trumps!.table.find(
      (t) => t.definitionId === "pressure-supply",
    )!;
    const b = s.round.trumps!.table.find((t) => t.definitionId === "harvest")!;
    expect(cmds[0]).toMatchObject({
      ownTargetId: a.effectId,
      targetId: b.effectId,
    });
    const result = play(s, "table-exchange");
    ledger(result);
    expect(result.state.round.hands).toBe(before);
    expect(
      result.state.round.trumps!.table.find((t) => t.effectId === a.effectId)!
        .owner,
    ).toBe("ai");
    expect(
      result.state.round.trumps!.table.find((t) => t.effectId === b.effectId),
    ).toMatchObject({
      owner: "human",
      remainingCharges: 2,
      sourceInstanceId: b.sourceInstanceId,
    });
  });
  it.each([
    "pressure",
    "pressure-supply",
    "shield",
    "full-shield",
    "last-stand",
    "risk-pledge",
    "harvest",
    "supply-cache",
  ])("permits the explicit transferable %s definition", (id) => {
    let s = fixture([id, "table-exchange"], ["pressure"]);
    s = play(s, id).state;
    s = act(s, "Stay").state;
    s = play(s, "pressure").state;
    s = act(s, "Stay").state;
    const cmds = commandIDs(s, "table-exchange");
    expect(cmds).toHaveLength(1);
    const result = play(s, "table-exchange");
    ledger(result);
    expect(
      result.state.round.trumps!.table.find(
        (t) => t.sourceInstanceId === "human-0",
      )!.owner,
    ).toBe("ai");
  });
  it("detaches a binding when a later non-card skill deletes its number", () => {
    let s = fixture(["face-lighten"]);
    s = play(s, "face-lighten").state;
    const r = deleteNumber(s.round, "human", s.round.hands.human[1].instanceId);
    expect(r.trumps!.table).toEqual([]);
    expect(r.lastPlay).toBeNull();
    expect(r.trumps!.destroyed).toHaveLength(1);
  });
  it("ignores suspended records for point target, face contribution and Symbiosis until REQ-024 resumes them", () => {
    let s = fixture(["target-17", "face-lighten", "symbiosis"]);
    for (const id of ["target-17", "face-lighten", "symbiosis"])
      s = play(s, id).state;
    const table = s.round.trumps!.table.map((t) => ({
      ...t,
      suppressed: true,
    }));
    const r = freezeData({
      ...s.round,
      trumps: { ...s.round.trumps!, table },
      pointTarget: 21,
    });
    const state = freezeData({ ...s, round: r });
    expect(observeMatch(state, "human").round.hands.human.total).toBe(21);
    expect(finish(state).round.result!.totals).toEqual({ human: 21, ai: 17 });
  });
});
describe("additional per-card precondition and composition boundaries", () => {
  it("rejects Return/Remove/Exchange when the required side has only its logical hidden slot", () => {
    let s = fixture(["return", "exchange"]);
    s = play(s, "return").state;
    expect(play(s, "exchange").state).toBe(s);
    s = fixture(["remove"], ["return"]);
    s = act(s, "Stay").state;
    s = play(s, "return").state;
    s = act(s, "Stay").state;
    expect(play(s, "remove").state).toBe(s);
  });
  it("Best Draw uses bound contributions, while pending Symbiosis waits until settlement", () => {
    let s = fixture(["face-lighten", "best-draw"]);
    s = play(s, "face-lighten").state;
    s = play(s, "best-draw").state;
    expect(values(s, "human")).toEqual([10, 11, 2]);
    expect(observeMatch(s, "human").round.hands.human.total).toBe(21);
    s = fixture(["symbiosis", "best-draw"], [], [10, 4, 3, 5]);
    s = play(s, "symbiosis").state;
    s = play(s, "best-draw").state;
    expect(values(s, "human")).toEqual([10, 3, 8]);
  });
  it("Sweep cancels pending Symbiosis without undoing an already applied multiplier", () => {
    let s = fixture(["double-hidden", "symbiosis"], ["destroy-all"]);
    s = play(s, "double-hidden").state;
    s = play(s, "symbiosis").state;
    s = act(s, "Stay").state;
    const result = play(s, "destroy-all");
    ledger(result);
    s = result.state;
    expect(s.round.trumps!.table).toEqual([]);
    expect(s.round.hiddenMultipliers.ai).toBe(2);
    expect(finish(s).round.result!.totals).toEqual({ human: 21, ai: 25 });
  });
  it("rejects duplicate Expose and avoids duplicate global reveal entries at settlement", () => {
    let s = fixture(["reveal-opponent", "reveal-opponent"]);
    s = play(s, "reveal-opponent").state;
    expect(play(s, "reveal-opponent").state).toBe(s);
    const final = finish(s);
    expect(new Set(final.round.revealed).size).toBe(2);
    expect(final.round.revealed).toHaveLength(2);
  });
  it("Rotate rejects a one-card pile; Scry grants only the one value still present", () => {
    let s = fixture(["deck-rotate", "scry"]);
    while (s.round.deck.length > 1) s = act(s, "Hit").state;
    expect(play(s, "deck-rotate").state).toBe(s);
    const value = s.round.deck[0].value;
    s = play(s, "scry").state;
    expect(observeMatch(s, "human").round.peek).toEqual([value]);
  });
  it("Table Exchange requires two allowed records and rejects a stale own record", () => {
    const empty = fixture(["table-exchange"]);
    expect(play(empty, "table-exchange").state).toBe(empty);
    let s = fixture(["pressure", "table-exchange"], ["harvest", "destroy"]);
    s = play(s, "pressure").state;
    s = act(s, "Stay").state;
    s = play(s, "harvest").state;
    s = act(s, "Stay").state;
    const captured = commandIDs(s, "table-exchange")[0];
    s = act(s, "Stay").state;
    s = play(s, "destroy").state;
    s = act(s, "Stay").state;
    const result = transitionMatch(
      s,
      { ...captured, roundNumber: s.roundNumber },
      () => {
        throw new Error("No random");
      },
    );
    expect(result.state).toBe(s);
    expect(result.events).toEqual([]);
  });
});
describe("private scry and deck changes", () => {
  it("Scry privately shows at most two ordered values; opponent payloads and snapshots stay identical", () => {
    const a = fixture(["scry"], [], [10, 8, 11, 9, 1, 2]),
      b = fixture(["scry"], [], [10, 8, 11, 9, 2, 1]);
    expect(observeMatch(a, "human")).toEqual(observeMatch(b, "human"));
    const x = play(a, "scry"),
      y = play(b, "scry");
    ledger(x);
    ledger(y);
    expect(observeMatch(x.state, "human").round.peek).toEqual([1, 2]);
    expect(observeMatch(y.state, "human").round.peek).toEqual([2, 1]);
    expect(projectMatchTransition(x, "ai")).toEqual(
      projectMatchTransition(y, "ai"),
    );
    expect(JSON.stringify(projectMatchTransition(x, "ai"))).not.toContain(
      "privateCards",
    );
    expect(
      projectMatchTransition(x, "human").events.some(
        (e) =>
          e.type === "round" &&
          e.event.type === "trump" &&
          e.event.privateCards?.length === 2,
      ),
    ).toBe(true);
  });
  it("Rotate needs at least two cards, reveals no value, and invalidates current scry positions", () => {
    let s = fixture(["scry", "deck-rotate"]);
    s = play(s, "scry").state;
    const deck = s.round.deck;
    const result = play(s, "deck-rotate");
    ledger(result);
    expect(result.state.round.deck).toEqual([...deck.slice(1), deck[0]]);
    expect(observeMatch(result.state, "human").round.peek).toBeNull();
    const event = result.events.filter((e) => e.type === "round").at(-1)!;
    if (event.type === "round" && event.event.type === "trump") {
      expect(event.event.effect).toBe("rotated");
      expect(event.event.card).toBeUndefined();
      expect(event.event.targetId).toBeUndefined();
    }
    const empty = emptyNumbers(fixture(["deck-rotate", "scry"]));
    expect(play(empty, "deck-rotate").state).toBe(empty);
    const failed = play(empty, "scry");
    expect(observeMatch(failed.state, "human").round.peek).toEqual([]);
  });
  it("invalidates scry on ordinary and effect draws/returns, but not on a pure target change", () => {
    for (const id of ["draw-2", "return", "forced-draw", "redraw", "trim"]) {
      let s = fixture(["scry", id]);
      s = play(s, "scry").state;
      s = play(s, id).state;
      expect(observeMatch(s, "human").round.peek).toBeNull();
    }
    let s = fixture(["scry", "target-24"]);
    s = play(s, "scry").state;
    s = play(s, "target-24").state;
    expect(observeMatch(s, "human").round.peek).toHaveLength(2);
    s = act(s, "Hit").state;
    expect(observeMatch(s, "human").round.peek).toBeNull();
  });
});
describe("formal multi-card turn integration", () => {
  it("returns, draws, swaps and changes target before Stay; opponent response grants a fresh decision", () => {
    let s = fixture(
      ["return", "draw-2", "exchange", "target-24", "best-draw"],
      ["target-17"],
    );
    for (const id of ["return", "draw-2", "exchange", "target-24"]) {
      const result = play(s, id);
      ledger(result);
      s = result.state;
      expect(s.round.turn!.player).toBe("human");
      expect(s.round.turn!.number).toBe(1);
    }
    s = act(s, "Stay").state;
    expect(s.phase).toBe("playing");
    expect(s.round.quietStays).toBe(0);
    s = play(s, "target-17").state;
    s = act(s, "Stay").state;
    expect(s.round.turn!.player).toBe("human");
    expect(s.round.turn!.number).toBe(3);
    expect(observeMatch(s, "human").round.hands.human.total).toBe(19);
    s = play(s, "best-draw").state;
    expect(s.round.phase).toBe("acting");
    s = act(s, "Stay").state;
    s = act(s, "Stay").state;
    expect(s.phase).toBe("playing");
    const end = act(s, "Stay");
    ledger(end);
    expect(end.state.round.result).toMatchObject({
      winner: "ai",
      pointTarget: 17,
    });
    expect(end.state.game.points).toEqual({ human: 0, ai: 1 });
    expect(end.events.filter((e) => e.type === "round-scored")).toHaveLength(1);
    expect(
      end.events.flatMap((e) => (e.type === "round" ? [e.event.type] : [])),
    ).toEqual(["stay", "reveal", "reveal", "settled"]);
  });
});
describe("capacity, stale targets and command atomicity", () => {
  it("replaces its own target at five slots, but an opposing target cannot offset own capacity", () => {
    let s = fixture([
      "target-17",
      "filler",
      "filler",
      "filler",
      "filler",
      "target-24",
    ]);
    for (const id of ["target-17", "filler", "filler", "filler", "filler"])
      s = play(s, id).state;
    const own = play(s, "target-24");
    ledger(own);
    expect(own.state.round.trumps!.table).toHaveLength(5);
    let other = fixture(
      ["filler", "filler", "filler", "filler", "filler", "target-24", "draw-2"],
      ["target-17"],
    );
    for (let i = 0; i < 5; i++) other = play(other, "filler").state;
    other = act(other, "Stay").state;
    other = play(other, "target-17").state;
    other = act(other, "Stay").state;
    expect(play(other, "target-24").state).toBe(other);
    expect(play(other, "draw-2").state).not.toBe(other);
  });
  it("preflights a full mixed card before any cost/draw, while an allowed failed onPlay still places", () => {
    let s = fixture([
      "filler",
      "filler",
      "filler",
      "filler",
      "filler",
      "mixed",
      "fee",
    ]);
    for (let i = 0; i < 5; i++) s = play(s, "filler").state;
    const fee = s.round.trumps!.hands.human.find(
      (c) => c.definitionId === "fee",
    )!.instanceId;
    const random = vi.fn(() => 0);
    const denied = play(s, "mixed", { costIds: [fee] }, random as never);
    expect(denied.state).toBe(s);
    expect(denied.events).toEqual([]);
    expect(random).not.toHaveBeenCalled();
    const failed = play(fixture(["mixed", "fee"], [], [10, 2, 11, 9]), "mixed");
    ledger(failed);
    expect(values(failed.state, "human")).toEqual([10, 11]);
    expect(failed.state.round.pointTarget).toBe(24);
    expect(failed.state.round.trumps!.table).toHaveLength(1);
    expect(
      failed.state.round.trumps!.destroyed.filter((d) => d.reason === "cost"),
    ).toHaveLength(1);
  });
  it.each([
    { onPlay: [{ type: "hidden-multiplier", target: "opponent", value: 3 }] },
    { onPlay: [{ type: "scry", count: 3 }] },
    { onPlay: [], table: { pointTarget: 17, kind: "symbiosis" } },
    { onPlay: [], table: { pointTarget: null, kind: "unknown" } },
  ])(
    "rejects unsupported new effect parameters before initialization randomness",
    (bad) => {
      const random = vi.fn(() => 0.25);
      const rules = {
        version: 1,
        pointTarget: 21,
        trumps: { tableCapacity: 5, definitions: { bad } },
      };
      expect(() => createMatch(random, rules as never)).toThrow(RangeError);
      expect(random).not.toHaveBeenCalled();
    },
  );
  it("rejects a formerly visible face-up target after the opponent returns it", () => {
    let s = fixture(["face-burden"], ["return"]);
    const command = commandIDs(s, "face-burden")[0];
    s = act(s, "Stay").state;
    s = play(s, "return").state;
    s = act(s, "Stay").state;
    const random = vi.fn(() => 0.5);
    const result = transitionMatch(
      s,
      { ...command, roundNumber: s.roundNumber },
      random,
    );
    expect(result.state).toBe(s);
    expect(result.events).toEqual([]);
    expect(random).not.toHaveBeenCalled();
  });
});
