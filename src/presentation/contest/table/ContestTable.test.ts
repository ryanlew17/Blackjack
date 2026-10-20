// @req REQ-2026-018: the rendered table cannot distinguish unrevealed opponents.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createMatch,
  observeMatch,
  transitionMatch,
} from "../../../domain/contest/engine";
import { fixedRandom } from "../../../domain/contest/engine/testHelpers";
import type { NumberValue } from "../../../domain/contest/types";
import { en, zh } from "../../i18n";
import { ContestTable } from "./ContestTable";

function fixture(hidden: NumberValue) {
  const shuffle = fixedRandom([10, hidden, 8, 3]);
  let coin = true;
  const random = () => {
    if (coin) {
      coin = false;
      return 0.25;
    }
    return shuffle();
  };
  return { state: createMatch(random).state, random };
}
const render = (state: ReturnType<typeof fixture>["state"], t = en) =>
  renderToStaticMarkup(
    createElement(ContestTable, {
      match: observeMatch(state, "human"),
      busy: false,
      reduced: true,
      t,
    }),
  );

describe("contest table information boundary", () => {
  it.each([en, zh])(
    "renders identical DOM for different hidden cards in either language",
    (t) => {
      const a = render(fixture(4).state, t);
      const b = render(fixture(5).state, t);
      expect(a).toBe(b);
      expect(a).toContain(`aria-label="${t.hidden}"`);
      expect(a).toContain(`${t.numberCard} 10 · ${t.privateCard}`);
      expect(a).toContain("3 + ?");
    },
  );
  it("exposes the opponent value only after the engine reveals it", () => {
    const { state, random } = fixture(4);
    const first = transitionMatch(
      state,
      { type: "Stay", player: "human", roundNumber: 1 },
      random,
    ).state;
    const result = transitionMatch(
      first,
      { type: "Stay", player: "ai", roundNumber: 1 },
      random,
    ).state;
    const html = render(result);
    expect(html).not.toContain(`aria-label="${en.hidden}"`);
    expect(html).toContain(`aria-label="${en.numberCard} 4"`);
    expect(html).not.toContain(en.privateCard);
  });
});
