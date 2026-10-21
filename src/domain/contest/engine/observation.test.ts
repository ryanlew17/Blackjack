// @req REQ-2026-022: instance identity/resource migration preserves existing rule regressions.
// @req REQ-2026-015: noninterference includes event payloads and every snapshot.
import { describe, expect, it } from "vitest";
import type { NumberValue } from "../types";
import { NUMBER_VALUES } from "./numbers";
import { legalActions, observeRound, projectRoundTransition } from "./index";
import { act, fixedRound, settle, cardValues } from "./testHelpers";

function assertNoDeck(value: unknown) {
  if (value !== null && typeof value === "object") {
    expect(Object.keys(value)).not.toContain("deck");
    for (const child of Object.values(value)) assertNoDeck(child);
  }
}

describe("round observations and projected replay", () => {
  it.each(["human", "ai"] as const)(
    "shows %s its own private card but no opponent total or derived bust",
    (viewer) => {
      const state = fixedRound([10, 9, 11, 8]).state;
      const opponent = viewer === "human" ? "ai" : "human";
      const view = observeRound(state, viewer);
      expect(view.hands[viewer].cards[0]).toEqual({
        value: state.hands[viewer][0].value,
        faceDown: true,
      });
      expect(view.hands[viewer].total).toBe(viewer === "human" ? 21 : 17);
      expect(view.hands[opponent]).toEqual({
        cards: [
          { value: null, faceDown: true },
          { value: state.hands[opponent][1].value, faceDown: false },
        ],
        visibleTotal: state.hands[opponent][1].value,
        total: null,
      });
      expect(view.deckCount).toBe(7);
      expect(view.result).toBeNull();
      assertNoDeck(view);
      expect(Object.keys(view.hands[opponent])).toEqual([
        "cards",
        "visibleTotal",
        "total",
      ]);
    },
  );
  it.each(["human", "ai"] as const)(
    "projects all dealing payloads and partial snapshots for %s",
    (viewer) => {
      const initial = fixedRound([10, 9, 11, 8]);
      const projected = projectRoundTransition(initial, viewer);
      const opponent = viewer === "human" ? "ai" : "human";
      expect(projected.events).toHaveLength(4);
      for (const event of projected.events) {
        expect(event.type).toBe("deal");
        if (event.type !== "deal") throw new Error("Unexpected fixture event");
        expect(event.card).toEqual(
          event.state.hands[event.player].cards[event.index],
        );
        if (event.player === opponent && event.index === 0)
          expect(event.card.value).toBeNull();
        if (event.state.hands[opponent].cards.length > 0)
          expect(event.state.hands[opponent].cards[0].value).toBeNull();
        expect(event.state.result).toBeNull();
      }
      assertNoDeck(projected);
      expect(projected.state.hands[opponent].total).toBeNull();
    },
  );
  it("Hit is public while the original opponent private card stays concealed", () => {
    const state = act(fixedRound([10, 9, 11, 8, 7]).state, "Stay").state;
    const hit = projectRoundTransition(act(state, "Hit"), "human");
    expect(hit.events[0]).toMatchObject({
      type: "hit",
      player: "ai",
      card: { value: 7, faceDown: false },
    });
    expect(hit.state.hands.ai.cards).toEqual([
      { value: null, faceDown: true },
      { value: 8, faceDown: false },
      { value: 7, faceDown: false },
    ]);
    expect(hit.state.hands.ai.total).toBeNull();
    expect(hit.state.result).toBeNull();
    expect(legalActions(hit.state)).toEqual(["Hit", "Stay"]);
    assertNoDeck(hit);
  });
  it("reveals each private value only in its reveal event, then publishes the final result", () => {
    const state = fixedRound([10, 9, 11, 8]).state;
    const projected = projectRoundTransition(settle(state), "human");
    expect(projected.events.map((event) => event.type)).toEqual([
      "stay",
      "reveal",
      "reveal",
      "settled",
    ]);
    expect(
      projected.events
        .slice(0, 2)
        .every((event) => event.state.hands.ai.cards[0].value === null),
    ).toBe(true);
    expect(projected.events[2]).toMatchObject({
      type: "reveal",
      player: "ai",
      card: { value: 9, faceDown: false },
    });
    expect(projected.events[2].state.hands.ai.total).toBe(17);
    expect(projected.events[2].state.result).toBeNull();
    expect(
      projected.state.hands.human.cards.every((card) => !card.faceDown),
    ).toBe(true);
    expect(projected.state.hands.ai.cards.every((card) => !card.faceDown)).toBe(
      true,
    );
    expect(projected.state.result?.winner).toBe("human");
    expect(legalActions(projected.state)).toEqual([]);
    assertNoDeck(projected);
  });
  it.each(["human", "ai"] as const)(
    "keeps %s observations, replay and legal actions identical for all unknown-card rotations",
    (viewer) => {
      const known: readonly NumberValue[] = [10, 11, 8];
      const unknown = NUMBER_VALUES.filter((value) => !known.includes(value));
      const variants = unknown.map((_, i) => {
        const rotation = [...unknown.slice(i), ...unknown.slice(0, i)];
        return fixedRound(
          [10, rotation[0], 11, 8, ...rotation.slice(1)],
          viewer,
        );
      });
      const reference = projectRoundTransition(variants[0], viewer);
      for (const variant of variants) {
        expect(cardValues(variant.state.hands[viewer])).toEqual([10, 11]);
        expect(projectRoundTransition(variant, viewer)).toEqual(reference);
        expect(legalActions(observeRound(variant.state, viewer))).toEqual([
          "Hit",
          "Stay",
        ]);
        const first = act(variant.state, "Stay");
        expect(first.state.result).toBeNull();
        expect(projectRoundTransition(first, viewer)).toEqual(
          projectRoundTransition(act(variants[0].state, "Stay"), viewer),
        );
        const opponent = viewer === "human" ? "ai" : "human";
        expect(legalActions(observeRound(first.state, opponent))).toEqual([
          "Hit",
          "Stay",
        ]);
      }
      expect(
        new Set(
          variants.map(
            (variant) =>
              variant.state.hands[viewer === "human" ? "ai" : "human"][0].value,
          ),
        ).size,
      ).toBe(8);
    },
  );
  it("does not publish an opponent bust or let it affect public legality", () => {
    const a = act(
      act(fixedRound([10, 1, 11, 8, 4]).state, "Stay").state,
      "Hit",
    ).state;
    const b = act(
      act(fixedRound([10, 9, 11, 8, 4]).state, "Stay").state,
      "Hit",
    ).state;
    expect(observeRound(a, "human")).toEqual(observeRound(b, "human"));
    expect(legalActions(observeRound(a, "human"))).toEqual(
      legalActions(observeRound(b, "human")),
    );
    expect(cardValues(a.hands.ai)).toEqual([1, 8, 4]);
    expect(cardValues(b.hands.ai)).toEqual([9, 8, 4]);
  });
  it("separates view arrays and freezes them so consumers cannot mutate authority", () => {
    const initial = fixedRound([10, 9, 11, 8]);
    const view = projectRoundTransition(initial, "human");
    expect(() =>
      Object.assign(view.state.hands.ai.cards[0], { value: 9 }),
    ).toThrow();
    expect(() =>
      Object.assign(view.events[1], { card: { value: 9, faceDown: false } }),
    ).toThrow();
    expect(() =>
      (view.state.hands.ai.cards as unknown[]).push({
        value: 7,
        faceDown: false,
      }),
    ).toThrow();
    expect(cardValues(initial.state.hands.ai)).toEqual([9, 8]);
  });
});
