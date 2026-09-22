import { type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  score,
  totalWager,
  type GameEvent,
  type GameState,
} from "../../domain/game";
import type { Language } from "../../infrastructure/save";
import { formatChips } from "../format";
import type { Copy } from "../i18n";
import { Card } from "./Card";
import { Chip } from "./Chip";
import { Icon } from "./Icon";

export function GameTable({
  game: g,
  effect,
  effectId,
  reduced,
  t,
  language,
  onShowHistory,
}: {
  game: GameState;
  effect?: GameEvent["type"];
  effectId?: number;
  reduced: boolean;
  t: Copy;
  language: Language;
  onShowHistory: () => void;
}) {
  const hand = g.hands[0];
  const isBetting = g.phase === "betting";
  const depleted = isBetting && g.balance + hand.bet < 100;
  const hiddenDealer = g.phase === "player" || g.phase === "insurance";
  const dealerScore =
    g.dealer.length > 0
      ? score(hiddenDealer ? g.dealer.slice(0, 1) : g.dealer).total
      : null;
  return (
    <section
      className={`felt-table ${isBetting ? "betting-table" : ""}`}
      aria-label="Blackjack"
    >
      <div className="table-trim" />
      <AnimatePresence>
        {!reduced && (effect === "chip" || effect === "result") && (
          <motion.div
            key={effectId}
            className={`chip-transfer ${effect === "result" ? "returning" : ""}`}
            aria-hidden="true"
            initial={{
              opacity: 0,
              y: effect === "chip" ? 125 : 0,
              scale: 0.7,
            }}
            animate={{
              opacity: [0, 1, 0],
              y: effect === "chip" ? 0 : -125,
              scale: 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <Chip value={100} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="table-meta">
        <span>
          {t.round} <b>{String(g.round).padStart(3, "0")}</b>
        </span>
        <button onClick={onShowHistory} aria-label={t.showHistory}>
          <Icon name="history" />
        </button>
      </div>
      <div className="dealer-zone hand-zone">
        <div className="hand-label">
          {t.dealer}
          {dealerScore !== null && (
            <span className="score">
              {dealerScore}
              {hiddenDealer ? " + ?" : ""}
            </span>
          )}
        </div>
        <div
          className="cards"
          style={{ "--count": Math.max(g.dealer.length, 2) } as CSSProperties}
        >
          {g.dealer.length ? (
            g.dealer.map((card, i) => (
              <Card
                key={`${g.round}-${card}`}
                card={card}
                hidden={hiddenDealer && i === 1}
                reduced={reduced}
                t={t}
              />
            ))
          ) : (
            <>
              <div className="card-placeholder">
                <span>♠</span>
              </div>
              <div className="card-placeholder">
                <span>♠</span>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="table-center">
        <div className="table-wordmark">
          BLACKJACK <span>3 : 2</span>
        </div>
        <div className="table-rule">{t.footer2}</div>
        <div className="ornament">
          <i />
          <span>◆</span>
          <i />
        </div>
      </div>
      <div className="wager-display">
        <AnimatePresence mode="wait">
          {hand.bet > 0 ? (
            <motion.div
              key="wager"
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="wager-active"
            >
              <span className="mini-chip">◈</span>
              <div>
                <small>{t.betLabel}</small>
                <strong>{formatChips(totalWager(g), language)}</strong>
              </div>
            </motion.div>
          ) : (
            <div className="wager-ring">◈</div>
          )}
        </AnimatePresence>
      </div>
      {/* @req REQ-2026-004 Each hand keeps its own cards, wager and result. */}
      <div
        className={`player-zone hand-zone ${g.hands.length > 1 ? "split-hands" : ""}`}
      >
        {g.hands.map((h, index) => {
          const playerScore = score(h.cards);
          const active = g.phase === "player" && g.activeHand === index;
          return (
            <div
              key={index}
              className={`player-hand ${active ? "active-hand" : ""}`}
              aria-current={active ? "step" : undefined}
            >
              <div
                className="cards"
                style={
                  { "--count": Math.max(h.cards.length, 2) } as CSSProperties
                }
              >
                {h.cards.length ? (
                  h.cards.map((card) => (
                    <Card
                      key={`${g.round}-${card}`}
                      card={card}
                      reduced={reduced}
                      t={t}
                    />
                  ))
                ) : (
                  <div className="opening-message">
                    <span className="tiny-diamond">◇</span>
                    <h2>{depleted ? t.exhausted : t.placeBet}</h2>
                    <p>{depleted ? t.exhaustedCopy : t.betHint}</p>
                  </div>
                )}
              </div>
              {h.cards.length > 0 && (
                <>
                  <div className="hand-label">
                    {t.player}
                    {g.hands.length > 1 ? ` ${index + 1}` : ""}
                    <span
                      className={`score ${playerScore.total > 21 ? "bust" : ""}`}
                    >
                      {playerScore.total}
                      {playerScore.soft ? ` ${t.soft}` : ""}
                    </span>
                  </div>
                  <div className="hand-detail">
                    {t.bet} {formatChips(h.bet, language)} ·{" "}
                    {h.outcome
                      ? t[`${h.outcome}Short`]
                      : active
                        ? t.activeHand
                        : h.status === "busted"
                          ? t.handBusted
                          : h.status === "stood"
                            ? t.handStood
                            : t.handWaiting}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="table-bottom-note">
        <span>♣</span>
        {t.roundNote}
        <span>♦</span>
      </div>
    </section>
  );
}
