// @req REQ-2026-027: real preparation metadata rendered through the production choice component.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { createContestController } from "../../application/contest/controller";
import { SkillSelection } from "./SkillSelection";
import { en, zh } from "../i18n";
it.each([en, zh])(
  "renders every standard description and leaves confirmation disabled until chosen",
  (t) => {
    const api = createContestController({ prepareSkills: true });
    api.start();
    const render = () =>
      renderToStaticMarkup(
        createElement(SkillSelection, {
          preparation: api.getPreparationSnapshot()!,
          t,
          onSelect: api.selectSkill,
          onConfirm: api.confirmSkill,
          onCancel: api.cancelSkillSelection,
        }),
      );
    const html = render();
    expect(html.match(/type="radio"/g)).toHaveLength(10);
    expect(html).toContain(t.skillSelectionTitle);
    expect(html).toContain(t["contest.skill.soul-transfer.description"]);
    expect(html).not.toContain(t["contest.skill.nullify.name"]);
    expect(html).toMatch(/type="submit"[^>]*disabled/);
    api.selectSkill("fortune", api.getPreparationSnapshot()!.inputId);
    expect(render()).not.toMatch(/type="submit"[^>]*disabled/);
    api.pause();
    expect(render()).toContain("<fieldset disabled");
    api.exit();
  },
);
