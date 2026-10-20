// @req REQ-2026-018
import type { Copy } from "../../i18n";
export function ContestRules({ t }: { t: Copy }) {
  return (
    <>
      <p className="modal-intro">{t.contestRulesIntro}</p>
      <ol className="rules-list">
        <li>{t.contestRuleDeck}</li>
        <li>{t.contestRuleTurns}</li>
        <li>{t.contestRuleResult}</li>
        <li>{t.contestRuleScore}</li>
      </ol>
      <p className="small-note">{t.contestMemoryHint}</p>
    </>
  );
}
