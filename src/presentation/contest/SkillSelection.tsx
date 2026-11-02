// @req REQ-2026-027: the normal pre-match screen consumes the application preparation contract.
import { useEffect, useRef } from "react";
import type { ContestPreparation } from "../../application/contest/types";
import type { SkillId } from "../../domain/contest/skills/catalog";
import type { Copy } from "../i18n";
import { text } from "./table/trumpView";

export function SkillSelection({
  preparation,
  t,
  onSelect,
  onConfirm,
  onCancel,
}: {
  preparation: ContestPreparation;
  t: Copy;
  onSelect: (id: SkillId, inputId: number) => void;
  onConfirm: (inputId: number) => void;
  onCancel: (inputId: number) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <main className="skill-selection">
      <h1 ref={heading} tabIndex={-1}>
        {t.skillSelectionTitle}
      </h1>
      <p>{t.skillSelectionIntro}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(preparation.inputId);
        }}
      >
        <fieldset disabled={preparation.paused}>
          <legend>{t.skillSelectionLegend}</legend>
          <div className="skill-selection-options">
            {preparation.options.map((option) => (
              <label key={option.id}>
                <input
                  type="radio"
                  name="contest-skill"
                  value={option.id}
                  checked={preparation.selected === option.id}
                  onChange={() => onSelect(option.id, preparation.inputId)}
                />
                <span>
                  <strong>{t[option.nameKey]}</strong>
                  <span>{t[option.descriptionKey]}</span>
                  <small>
                    {text(t.skillSelectionUses, { count: option.initialUses })}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="skill-selection-actions">
          <button
            type="button"
            className="secondary"
            disabled={preparation.paused}
            onClick={() => onCancel(preparation.inputId)}
          >
            {t.backHome}
          </button>
          <button
            type="submit"
            className="primary"
            disabled={!preparation.selected || preparation.paused}
          >
            {t.skillSelectionConfirm}
          </button>
        </div>
      </form>
    </main>
  );
}
