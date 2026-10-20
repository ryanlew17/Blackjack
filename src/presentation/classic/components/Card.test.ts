// @req REQ-2026-019: hidden fronts must be absent, including on fresh/recovered render.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Card } from "./Card";
import { en, zh } from "../../i18n";
import { rank, suit } from "../../../domain/classic/game";
for (const t of [en, zh]) {
  it(`renders identical hidden DOM for all classic values (${t.hidden})`, () => {
    const render = (card: number) =>
      renderToStaticMarkup(
        createElement(Card, { card, hidden: true, reduced: false, t }),
      );
    const baseline = render(0);
    for (let card = 1; card < 52; card++) expect(render(card)).toBe(baseline);
    expect(baseline).toContain(`aria-label="${t.hidden}"`);
    expect(baseline).not.toContain("card-front");
    expect(baseline).not.toContain("card-corner");
    expect(baseline).not.toContain("<text");
    expect(baseline).toContain("rotateY(180deg)");
  });
  it(`mounts the actual front only on reveal (${t.hidden})`, () => {
    for (const reduced of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(Card, { card: 24, hidden: false, reduced, t }),
      );
      expect(html).toContain("card-front red");
      expect(html).toContain(`aria-label="${rank(24)} ${suit(24)}"`);
      expect(html).toContain("card-corner");
      expect(html).not.toContain(`aria-label="${t.hidden}"`);
    }
  });
}
