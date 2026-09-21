import type { Copy } from "../../i18n";

export function RulesPanel({ t }: { t: Copy }) {
  return (
    <>
      <p className="modal-intro">{t.rulesIntro}</p>
      <ol className="rules-list">
        {t.rulesList.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <p className="small-note">{t.practice}</p>
    </>
  );
}
