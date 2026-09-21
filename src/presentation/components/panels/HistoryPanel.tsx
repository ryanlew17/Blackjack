import type { RoundRecord } from "../../../domain/game";
import type { Language } from "../../../infrastructure/save";
import { formatChips } from "../../format";
import type { Copy } from "../../i18n";

export function HistoryPanel({
  t,
  language,
  history,
}: {
  t: Copy;
  language: Language;
  history: RoundRecord[];
}) {
  return history.length ? (
    <div className="history-list">
      {history.map((r) => (
        <div className="history-row" key={r.round}>
          <span className="history-round">
            #{String(r.round).padStart(3, "0")}
          </span>
          <span>
            {t[`${r.outcome}Short`]}
            <small>
              {t.bet} {formatChips(r.bet, language)}
            </small>
          </span>
          <strong className={r.net > 0 ? "positive" : ""}>
            {r.net > 0 ? "+" : ""}
            {formatChips(r.net, language)}
          </strong>
        </div>
      ))}
    </div>
  ) : (
    <p className="modal-intro">{t.noHistory}</p>
  );
}
