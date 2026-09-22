import { insuranceNet, type RoundRecord } from "../../../domain/game";
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
            {r.hands.map((h, index) => (
              <small key={index}>
                {t.player} {index + 1} · {t[`${h.outcome}Short`]} · {t.bet}{" "}
                {formatChips(h.bet, language)} · {t.payout}{" "}
                {formatChips(h.net, language)}
              </small>
            ))}
            {r.insurance.outcome !== "not-offered" && (
              <small>
                {r.insurance.outcome === "declined" ? (
                  t.insuranceDeclined
                ) : (
                  <>
                    {r.insurance.outcome === "win"
                      ? t.insuranceWin
                      : t.insuranceLose}{" "}
                    · {t.bet} {formatChips(r.insurance.bet, language)} ·{" "}
                    {t.payout}{" "}
                    {formatChips(insuranceNet(r.insurance), language)}
                  </>
                )}
              </small>
            )}
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
