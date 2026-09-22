import {
  insuranceNet,
  type GameCommand,
  type GameState,
} from "../../domain/game";
import type { Language } from "../../infrastructure/save";
import { formatChips } from "../format";
import type { Copy } from "../i18n";
import { Chip } from "./Chip";
import { Icon } from "./Icon";

export function ControlDeck({
  game: g,
  busy,
  can,
  send,
  t,
  language,
  onNewGame,
  onOpenSaves,
}: {
  game: GameState;
  busy: boolean;
  can: (action: GameCommand["type"]) => boolean;
  send: (command: GameCommand) => void;
  t: Copy;
  language: Language;
  onNewGame: () => void;
  onOpenSaves: () => void;
}) {
  const hand = g.hands[0];
  const isBetting = g.phase === "betting";
  const depleted = isBetting && g.balance + hand.bet < 100;
  const outcome = g.outcome;
  const net = g.history[0]?.net ?? 0;
  const status = busy
    ? g.phase === "dealer"
      ? t.dealerTurn
      : t.dealing
    : isBetting
      ? t.waiting
      : g.phase === "settled"
        ? t.settled
        : g.phase === "insurance"
          ? t.insurancePhase
          : `${t.turn} · ${t.player} ${g.activeHand + 1}`;
  return (
    <section className="control-deck" aria-label={t.betLabel}>
      <div className="control-status" aria-live="polite">
        <span className={`status-dot ${busy ? "pulsing" : ""}`} />
        {status}
      </div>
      {g.insurance.outcome !== "not-offered" &&
        g.insurance.outcome !== "pending" && (
          <p className="insurance-result" aria-live="polite">
            {g.insurance.outcome === "declined" ? (
              t.insuranceDeclined
            ) : (
              <>
                {g.insurance.outcome === "win"
                  ? t.insuranceWin
                  : t.insuranceLose}{" "}
                · {t.bet} {formatChips(g.insurance.bet, language)} · {t.payout}{" "}
                {formatChips(insuranceNet(g.insurance), language)}
              </>
            )}
          </p>
        )}
      {g.phase === "insurance" ? (
        <div className="insurance-controls">
          <p>{t.insuranceHint}</p>
          <p>
            {t.insurance} · {formatChips(g.originalBet / 2, language)}
          </p>
          {g.balance < g.originalBet / 2 && <p>{t.insuranceUnaffordable}</p>}
          <div className="play-actions">
            <button
              className="primary"
              disabled={!can("insure")}
              onClick={() => send({ type: "insure" })}
            >
              {t.insure}
            </button>
            <button
              className="secondary"
              disabled={!can("declineInsurance")}
              onClick={() => send({ type: "declineInsurance" })}
            >
              {t.declineInsurance}
            </button>
          </div>
        </div>
      ) : isBetting ? (
        <>
          <div className="bet-controls">
            <div className="chip-selection">
              {[1, 10, 25, 100, 500].map((value) => (
                <button
                  key={value}
                  className="chip-button"
                  aria-label={`${t.chip} ${value}`}
                  disabled={!can("bet") || g.balance < value * 100}
                  onClick={() => send({ type: "bet", amount: value * 100 })}
                >
                  <Chip value={value} />
                </button>
              ))}
            </div>
            <div className="bet-tools">
              <button
                disabled={!can("undo")}
                onClick={() => send({ type: "undo" })}
              >
                {t.undo}
              </button>
              <button
                disabled={!can("clear")}
                onClick={() => send({ type: "clear" })}
              >
                {t.clear}
              </button>
              <button
                className="all-in"
                disabled={!can("allIn") || g.balance + hand.bet < 100}
                onClick={() => send({ type: "allIn" })}
              >
                {t.allIn}
              </button>
            </div>
            <button
              className="primary deal-button"
              disabled={!can("deal")}
              onClick={() => send({ type: "deal" })}
            >
              {t.deal}
              <Icon name="arrow" />
            </button>
          </div>
          {depleted && (
            <div className="recovery-actions">
              <button onClick={onNewGame}>{t.newGame}</button>
              <button onClick={onOpenSaves}>{t.saves}</button>
            </div>
          )}
        </>
      ) : g.phase === "settled" ? (
        <div className="result-row">
          <div className={`result-copy result-${outcome}`} aria-live="polite">
            <h2>{outcome ? t[outcome] : ""}</h2>
            <p>{outcome ? t[`${outcome}Sub`] : ""}</p>
          </div>
          <div className={`net-result ${net > 0 ? "positive" : ""}`}>
            <small>{t.payout}</small>
            <strong>
              {net > 0 ? "+" : ""}
              {formatChips(net, language)}
            </strong>
          </div>
          <button
            className="primary"
            disabled={!can("next")}
            onClick={() => send({ type: "next" })}
          >
            {t.next}
            <Icon name="arrow" />
          </button>
        </div>
      ) : (
        <div className="play-actions">
          <button
            className="secondary"
            title={t.helpSplit}
            disabled={!can("split")}
            onClick={() => send({ type: "split" })}
          >
            {t.split}
          </button>
          <button
            className="primary"
            aria-label={t.hit}
            disabled={!can("hit")}
            onClick={() => send({ type: "hit" })}
          >
            <span>＋</span>
            {t.hit}
          </button>
          <button
            className="secondary"
            aria-label={t.stand}
            disabled={!can("stand")}
            onClick={() => send({ type: "stand" })}
          >
            <span>−</span>
            {t.stand}
          </button>
          <button
            className="secondary double-button"
            aria-label={t.double}
            title={t.helpDouble}
            disabled={!can("double")}
            onClick={() => send({ type: "double" })}
          >
            <span>×2</span>
            {t.double}
          </button>
          <button
            className="secondary"
            title={t.helpSurrender}
            disabled={!can("surrender")}
            onClick={() => send({ type: "surrender" })}
          >
            {t.surrender}
          </button>
        </div>
      )}
    </section>
  );
}
