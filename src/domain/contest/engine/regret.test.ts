// @req REQ-2026-023: inverse transactions preserve destruction, paid resources and learned information.
import { describe, expect, it, vi } from "vitest";
import { freezeData } from "../immutable";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  projectMatchTransition,
  legalTrumpCommands,
  generateNumber,
  deleteNumber,
  transferNumber,
} from "./index";
import type {
  MatchState,
  MatchTransition,
  ContestRandomSources,
  RoundRules,
} from "./index";
import { fixedRandom } from "./testHelpers";
import {
  NUMERIC_RULES,
  numericFixture as fixture,
  numericPlay as play,
  numericAct as act,
  numericFinish as finish,
  values,
} from "./numberEffectTestHelpers";
function ledger(result: MatchTransition, initial?: number) {
  for (const s of [result.state, ...result.events.map((e) => e.state)]) {
    const r = s.round,
      numbers = [
        ...r.deck,
        ...r.hands.human,
        ...r.hands.ai,
        ...r.deletedNumbers,
      ];
    expect(numbers.filter((c) => c.origin.type === "initial")).toHaveLength(11);
    expect(numbers.filter((c) => c.origin.type === "generated")).toHaveLength(
      r.nextNumberId - 1,
    );
    expect(new Set(numbers.map((c) => c.instanceId)).size).toBe(numbers.length);
    const t = r.trumps!,
      bodies = [
        ...t.stock.human,
        ...t.stock.ai,
        ...t.hands.human,
        ...t.hands.ai,
        ...t.destroyed.map((d) => d.instance),
      ];
    expect(new Set(bodies.map((c) => c.instanceId)).size).toBe(bodies.length);
    if (initial !== undefined)
      expect(bodies.filter((c) => c.origin.type !== "generated")).toHaveLength(
        initial,
      );
    for (const record of t.table) {
      expect(
        t.destroyed.some(
          (d) =>
            d.reason === "played" &&
            d.instance.instanceId === record.sourceInstanceId,
        ),
      ).toBe(true);
      if (record.cardId)
        expect(
          [...r.hands.human, ...r.hands.ai].some(
            (c) => c.instanceId === record.cardId,
          ),
        ).toBe(true);
    }
  }
}
function noUndo(state: MatchState) {
  const card = state.round.trumps!.hands[state.round.turn!.player].find(
    (c) => c.definitionId === "regret",
  )!;
  expect(
    legalTrumpCommands(
      observeMatch(state, state.round.turn!.player).round,
    ).some((c) => c.instanceId === card.instanceId),
  ).toBe(false);
  const random = vi.fn(() => 0.5);
  const result = play(state, "regret", {}, random);
  expect(result.state).toBe(state);
  expect(result.events).toEqual([]);
  expect(random).not.toHaveBeenCalled();
}
describe("Regret numeric transactions and boundaries", () => {
  it("rejects initial-deal undo and clears the window on settlement/new Round", () => {
    let s = fixture(["regret"]);
    noUndo(s);
    s = act(s, "Hit").state;
    s = finish(s);
    expect(s.round.lastPlay).toBeNull();
    expect(
      transitionMatch(
        s,
        {
          type: "PlayTrump",
          player: "human",
          instanceId: "human-0",
          roundNumber: 1,
        },
        () => 0.5,
      ).state,
    ).toBe(s);
    s = transitionMatch(
      s,
      { type: "NextRound", roundNumber: 1 },
      fixedRandom([8, 10, 9, 11]),
    ).state;
    expect(s.round.lastPlay).toBeNull();
    // This Round starts with the AI, so return the Turn without creating a card transaction.
    s = act(s, "Stay").state;
    noUndo(s);
  });
  it("can undo the opponent's last Hit and a second Regret reverses that effect without restoring either trump", () => {
    const original = fixture([], ["regret", "regret"]);
    let s = act(original, "Hit").state;
    const hit = s.round.hands.human.at(-1)!;
    const first = play(s, "regret");
    ledger(first, 2);
    s = first.state;
    expect(values(s, "human")).toEqual([10, 11]);
    expect(s.round.deck.at(-1)).toBe(hit);
    expect(s.round.turn).toEqual({ player: "ai", number: 2, usedTrump: true });
    const second = play(s, "regret");
    ledger(second, 2);
    expect(second.state.round.hands.human.at(-1)).toBe(hit);
    expect(second.state.round.trumps!.hands.ai).toEqual([]);
    expect(
      second.state.round.trumps!.destroyed.filter((d) => d.reason === "played"),
    ).toHaveLength(2);
  });
  it("ignores intervening Stay, returns only the last number of a multi-number Hit, and never restores Turn", () => {
    const base = fixture(["regret"]);
    let s: MatchState = freezeData({
      ...base,
      round: {
        ...base.round,
        hitDrawCounts: { human: 2 as const, ai: 1 as const },
      },
    });
    s = act(s, "Hit").state;
    const first = s.round.hands.human[2],
      last = s.round.hands.human[3];
    s = act(s, "Stay").state;
    const result = play(s, "regret");
    ledger(result, 1);
    expect(result.state.round.hands.human.at(-1)).toBe(first);
    expect(result.state.round.deck.at(-1)).toBe(last);
    expect(result.state.round.turn).toEqual({
      player: "human",
      number: 3,
      usedTrump: true,
    });
    expect(result.state.round.quietStays).toBe(0);
  });
  it("ends the undo window when a non-card generate/delete/transfer changes numeric state", () => {
    for (const kind of ["generate", "delete", "transfer"]) {
      let s = act(fixture(["regret"]), "Hit").state;
      s = act(s, "Stay").state;
      const card = s.round.hands.human.at(-1)!;
      const r =
        kind === "generate"
          ? generateNumber(s.round, "human", 2, "skill")
          : kind === "delete"
            ? deleteNumber(s.round, "human", card.instanceId)
            : transferNumber(s.round, "human", "ai", card.instanceId);
      noUndo(freezeData({ ...s, round: r }));
    }
  });
});
describe("Regret committed trump effects", () => {
  it.each(["draw-2", "return", "exchange", "deck-rotate", "trim"] as const)(
    "reverses %s actual movement/order while leaving the consumed card dead",
    (id) => {
      const original = fixture([id, "regret"]);
      const played = play(original, id);
      const result = play(played.state, "regret");
      ledger(result, 2);
      expect(result.state.round.hands).toEqual(original.round.hands);
      expect(result.state.round.deck).toEqual(original.round.deck);
      expect(result.state.round.trumps!.hands.human).toEqual([]);
      expect(
        result.state.round.trumps!.destroyed.filter(
          (d) => d.reason === "played",
        ),
      ).toHaveLength(2);
      expect(result.state.round.turn!.usedTrump).toBe(true);
    },
  );
  it("restores only the most recent source, including a legally failed zero-effect card", () => {
    let s = fixture(["target-17", "draw-2", "regret"], [], [10, 2, 11, 9]);
    s = play(s, "target-17").state;
    s = play(s, "draw-2").state;
    const result = play(s, "regret");
    ledger(result, 3);
    expect(result.state.round.pointTarget).toBe(17);
    expect(result.state.round.trumps!.table).toHaveLength(1);
    expect(result.state.round.lastPlay).toMatchObject({
      type: "trump",
      deltas: [],
    });
    expect(values(result.state, "human")).toEqual([10, 11]);
  });
  it("restores replaced target records with new effect IDs; undoing Regret restores the replacement", () => {
    let s = fixture(["target-17", "target-24", "regret", "regret"]);
    s = play(s, "target-17").state;
    const first = s.round.trumps!.table[0];
    s = play(s, "target-24").state;
    const restored = play(s, "regret");
    ledger(restored, 4);
    s = restored.state;
    expect(s.round.pointTarget).toBe(17);
    expect(s.round.trumps!.table[0]).toMatchObject({
      sourceInstanceId: first.sourceInstanceId,
      pointTarget: 17,
    });
    expect(s.round.trumps!.table[0].effectId).not.toBe(first.effectId);
    const again = play(s, "regret");
    ledger(again, 4);
    expect(again.state.round.pointTarget).toBe(24);
    expect(again.state.round.trumps!.table).toHaveLength(1);
    expect(again.state.round.trumps!.destroyed).toHaveLength(4);
  });
  it("restores every swept record in its original order/owner with fresh IDs and charges", () => {
    let s = fixture(["target-17", "harvest"], ["destroy-all", "regret"]);
    s = play(s, "target-17").state;
    s = play(s, "harvest").state;
    const before = s.round.trumps!.table;
    s = act(s, "Stay").state;
    s = play(s, "destroy-all").state;
    expect(s.round.trumps!.table).toEqual([]);
    const restored = play(s, "regret");
    ledger(restored, 4);
    expect(restored.state.round.pointTarget).toBe(17);
    expect(
      restored.state.round.trumps!.table.map((t) => [
        t.definitionId,
        t.owner,
        t.remainingCharges,
      ]),
    ).toEqual([
      ["target-17", "human", undefined],
      ["harvest", "human", 2],
    ]);
    for (const t of restored.state.round.trumps!.table)
      expect(before.some((old) => old.effectId === t.effectId)).toBe(false);
  });
  it("reverses bound-card Redraw including binding removal, without reviving its physical source card", () => {
    let s = fixture(["face-lighten", "redraw", "regret"]);
    s = play(s, "face-lighten").state;
    const card = s.round.hands.human[1],
      record = s.round.trumps!.table[0];
    s = play(s, "redraw").state;
    expect(s.round.trumps!.table).toEqual([]);
    const restored = play(s, "regret");
    ledger(restored, 3);
    expect(restored.state.round.hands.human[1]).toBe(card);
    expect(observeMatch(restored.state, "human").round.hands.human.total).toBe(
      19,
    );
    expect(restored.state.round.trumps!.table[0]).toMatchObject({
      cardId: card.instanceId,
      sourceInstanceId: record.sourceInstanceId,
    });
    expect(restored.state.round.trumps!.table[0].effectId).not.toBe(
      record.effectId,
    );
    expect(restored.state.round.trumps!.destroyed).toHaveLength(3);
  });
  it("undoes numeric generation by deleting it; undoing that deletion generates a fresh identity", () => {
    let s = fixture(["creator", "regret", "regret"]);
    s = play(s, "creator").state;
    const first = s.round.hands.human.at(-1)!;
    s = play(s, "regret").state;
    expect(s.round.deletedNumbers.at(-1)).toBe(first);
    const restored = play(s, "regret");
    ledger(restored, 3);
    const second = restored.state.round.hands.human.at(-1)!;
    expect(second.value).toBe(1);
    expect(second.instanceId).not.toBe(first.instanceId);
    expect(second.origin).toMatchObject({ type: "generated" });
    expect(restored.state.round.deletedNumbers).toContain(first);
  });
  it("undoes a deleted bound number using a new numeric ID and remaps restored binding targets", () => {
    let s = fixture(["face-lighten", "eraser", "regret", "regret"]);
    const original = s.round.hands.human[1];
    s = play(s, "face-lighten").state;
    s = play(s, "eraser").state;
    expect(s.round.trumps!.table).toEqual([]);
    const restored = play(s, "regret");
    ledger(restored, 4);
    s = restored.state;
    const card = s.round.hands.human[1];
    expect(card.value).toBe(original.value);
    expect(card.instanceId).not.toBe(original.instanceId);
    expect(s.round.trumps!.table[0].cardId).toBe(card.instanceId);
    expect(observeMatch(s, "human").round.hands.human.total).toBe(19);
    const again = play(s, "regret");
    ledger(again, 4);
    expect(values(again.state, "human")).toEqual([10]);
    expect(again.state.round.trumps!.table).toEqual([]);
    expect(again.state.round.deletedNumbers.map((c) => c.instanceId)).toEqual([
      original.instanceId,
      card.instanceId,
    ]);
  });
  it("reverses hidden multiplier changes and Table Exchange without replaying onPlay", () => {
    let s = fixture(["double-hidden", "regret"]);
    s = play(s, "double-hidden").state;
    s = play(s, "regret").state;
    expect(s.round.hiddenMultipliers.ai).toBe(1);
    s = fixture(["pressure-supply", "table-exchange", "regret"], ["harvest"]);
    s = play(s, "pressure-supply").state;
    s = act(s, "Stay").state;
    s = play(s, "harvest").state;
    s = act(s, "Stay").state;
    const faces = s.round.hands,
      records = s.round.trumps!.table;
    s = play(s, "table-exchange").state;
    const result = play(s, "regret");
    ledger(result, 4);
    expect(result.state.round.hands).toBe(faces);
    expect(result.state.round.trumps!.table).toEqual(records);
  });
  it("undoes a full-capacity mixed replacement but never refunds its card or private fee", () => {
    let s = fixture([
      "target-17",
      "filler",
      "filler",
      "filler",
      "filler",
      "mixed",
      "fee",
      "regret",
    ]);
    for (const id of ["target-17", "filler", "filler", "filler", "filler"])
      s = play(s, id).state;
    const before = s.round.deck;
    const fee = s.round.trumps!.hands.human.find(
      (c) => c.definitionId === "fee",
    )!.instanceId;
    s = play(s, "mixed", { costIds: [fee] }).state;
    expect(s.round.pointTarget).toBe(24);
    expect(values(s, "human")).toEqual([10, 11, 2]);
    const result = play(s, "regret");
    ledger(result, 8);
    expect(result.state.round.pointTarget).toBe(17);
    expect(result.state.round.trumps!.table).toHaveLength(5);
    expect(result.state.round.deck).toEqual(before);
    expect(result.state.round.trumps!.hands.human).toEqual([]);
    expect(result.state.round.trumps!.destroyed).toHaveLength(8);
    expect(
      result.state.round.trumps!.destroyed.find(
        (d) => d.instance.instanceId === fee,
      )!.reason,
    ).toBe("cost");
  });
});
describe("Regret leaves knowledge and consumed random resources intact", () => {
  it("cannot unsee public Expose or a still-valid private Scry; deck undo never rewinds a scry revision", () => {
    let s = fixture(["reveal-opponent", "regret"]);
    s = play(s, "reveal-opponent").state;
    s = play(s, "regret").state;
    expect(observeMatch(s, "human").round.hands.ai.cards[0]).toEqual({
      value: 8,
      faceDown: false,
    });
    expect(observeMatch(s, "human").round.hands.ai.total).toBe(17);
    s = fixture(["scry", "regret"]);
    s = play(s, "scry").state;
    const known = observeMatch(s, "human").round.peek;
    s = play(s, "regret").state;
    expect(observeMatch(s, "human").round.peek).toEqual(known);
    s = fixture(["scry", "deck-rotate", "regret"]);
    s = play(s, "scry").state;
    const deck = s.round.deck,
      revision = s.round.deckRevision;
    s = play(s, "deck-rotate").state;
    s = play(s, "regret").state;
    expect(s.round.deck).toEqual(deck);
    expect(s.round.deckRevision).toBeGreaterThan(revision);
    expect(observeMatch(s, "human").round.peek).toBeNull();
  });
  it("deletes actual random supply results without returning stock; a second Regret regenerates new IDs without RNG", () => {
    const shuffle = fixedRandom([10, 8, 11, 9]);
    let coin = true;
    const sources: ContestRandomSources = {
      numbers: vi.fn(() => (coin ? ((coin = false), 0.25) : shuffle())),
      trumpGate: vi.fn(() => 0),
      trumpSelection: vi.fn(() => 0),
    };
    const r: RoundRules = {
      ...NUMERIC_RULES,
      trumps: {
        ...NUMERIC_RULES.trumps!,
        resources: {
          difficulty: "standard",
          handLimit: 8,
          gameGrant: 2,
          roundGrant: 1,
          hitProbability: 0.3,
          stock: { supply: 1, regret: 3, filler: 20 },
        },
      },
    };
    let s = createMatch(sources, r).state;
    const selection = vi.mocked(sources.trumpSelection);
    selection.mockReturnValueOnce(0.73).mockReturnValueOnce(0.17);
    const played = play(s, "supply", {}, sources);
    s = played.state;
    const received = played.events.flatMap((e) =>
      e.type === "round" && e.event.type === "resource" && e.event.instance
        ? [e.event.instance]
        : [],
    );
    expect(received).toHaveLength(2);
    const stock = s.round.trumps!.stock.human,
      calls = selection.mock.calls.length;
    const first = play(s, "regret", {}, sources);
    ledger(first, 48);
    s = first.state;
    expect(s.round.trumps!.stock.human).toBe(stock);
    for (const c of received)
      expect(
        s.round.trumps!.destroyed.some(
          (d) => d.instance.instanceId === c.instanceId,
        ),
      ).toBe(true);
    const second = play(s, "regret", {}, sources);
    ledger(second, 48);
    expect(second.state.round.trumps!.stock.human).toBe(stock);
    expect(second.state.round.trumps!.hands.human).toHaveLength(2);
    expect(
      second.state.round.trumps!.hands.human.every(
        (c) => c.origin.type === "generated",
      ),
    ).toBe(true);
    expect(
      second.state.round.trumps!.hands.human.every(
        (c) => !received.some((old) => old.instanceId === c.instanceId),
      ),
    ).toBe(true);
    expect(selection).toHaveBeenCalledTimes(calls);
    expect(sources.trumpGate).not.toHaveBeenCalled();
    expect(sources.numbers).toHaveBeenCalledTimes(11);
  });
  it("can spend a freshly generated Regret to undo its own grant without resurrecting that consumed card", () => {
    let s = fixture(["trump-maker"]);
    s = play(s, "trump-maker").state;
    const generated = s.round.trumps!.hands.human[0];
    expect(generated.definitionId).toBe("regret");
    const result = play(s, "regret");
    ledger(result, 1);
    expect(result.state.round.trumps!.hands.human).toEqual([]);
    expect(
      result.state.round.trumps!.destroyed.filter(
        (d) => d.instance.instanceId === generated.instanceId,
      ),
    ).toHaveLength(1);
    expect(result.state.round.lastPlay).toMatchObject({
      type: "trump",
      deltas: [],
    });
  });
  it("does not undo an ordinary Hit resource reward or publish the private inverse transaction", () => {
    const shuffle = fixedRandom([10, 8, 11, 9]);
    let coin = true;
    const sources: ContestRandomSources = {
      numbers: () => (coin ? ((coin = false), 0.25) : shuffle()),
      trumpGate: vi.fn(() => 0),
      trumpSelection: vi.fn(() => 0),
    };
    const rules: RoundRules = {
      ...NUMERIC_RULES,
      trumps: {
        ...NUMERIC_RULES.trumps!,
        resources: {
          difficulty: "standard",
          handLimit: 8,
          gameGrant: 2,
          roundGrant: 1,
          hitProbability: 0.3,
          stock: { regret: 1, filler: 20 },
        },
      },
    };
    let s = createMatch(sources, rules).state;
    s = act(s, "Hit", sources).state;
    const rewarded = s.round.trumps!.hands.human.at(-1)!;
    const result = play(s, "regret", {}, sources);
    ledger(result, 42);
    expect(result.state.round.trumps!.hands.human).toContain(rewarded);
    expect(values(result.state, "human")).toEqual([10, 11]);
    expect(sources.trumpGate).toHaveBeenCalledTimes(1);
    for (const viewer of ["human", "ai"] as const) {
      const projected = projectMatchTransition(result, viewer);
      expect(JSON.stringify(projected)).not.toContain("deltas");
      expect(JSON.stringify(projected)).not.toContain("deletedNumbers");
    }
  });
});
