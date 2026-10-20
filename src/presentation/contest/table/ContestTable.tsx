// @req REQ-2026-018: render only the application's current replay observation.
import type { ContestView } from "../../../application/contest/types";
import type { MatchObservation } from "../../../domain/contest/engine";
import type { Copy } from "../../i18n";
import { NumberCard } from "./NumberCard";

export function ContestTable({
  match,
  busy,
  reduced,
  t,
}: {
  match: MatchObservation;
  busy: boolean;
  reduced: boolean;
  t: Copy;
}) {
  const { round, game, wins } = match;
  return (
    <>
      <section className="match-scoreboard" aria-label={t.matchScore}>
        <div className="match-side">
          <span>{t.contestYou}</span>
          <strong>{wins.human}</strong>
        </div>
        <div className="match-format">
          <span className="eyebrow">{t.matchScore}</span>
          <b>{t.standardBo5}</b>
          <small>
            {t.firstToGames} {match.rules.gamesToWin}
          </small>
        </div>
        <div className="match-side opponent-score">
          <strong>{wins.ai}</strong>
          <span>{t.contestOpponent}</span>
        </div>
      </section>
      <section
        className="contest-table"
        aria-label={t.contestTable}
        aria-busy={busy}
        data-phase={match.phase}
        data-first-player={round.firstPlayer}
        data-round={match.roundNumber}
      >
        <div className="contest-game-strip">
          <span>
            {t.contestGame} <b>{game.number}</b>
            <i aria-hidden="true"> / </i>
            {t.contestRound} <b>{match.roundNumber}</b>
          </span>
          <span>
            {t.cardsRemaining} <b>{round.deckCount}</b>
          </span>
        </div>
        {(["ai", "human"] as const).map((player) => {
          const hand = round.hands[player];
          const active =
            round.phase === "acting" && round.turn?.player === player;
          return (
            <section
              key={player}
              className={`contest-hand contest-hand-${player}${active ? " acting-hand" : ""}`}
              aria-labelledby={`contest-${player}-label`}
            >
              <div className="contest-hand-heading">
                <h2 id={`contest-${player}-label`}>
                  {player === "human" ? t.contestYourHand : t.contestOpponent}
                </h2>
                <span className="contest-total" aria-label={t.cardTotal}>
                  {hand.total === null
                    ? `${hand.visibleTotal} + ?`
                    : hand.total}
                </span>
              </div>
              <div className="number-hand">
                {hand.cards.map((card, index) => (
                  <NumberCard
                    key={`${match.roundNumber}-${index}`}
                    card={card}
                    reduced={reduced}
                    t={t}
                  />
                ))}
              </div>
              <p className="hand-turn-note">
                {active ? t.currentActor : "\u00a0"}
              </p>
            </section>
          );
        })}
        <div className="contest-center">
          <div className="card-target">
            <span>{t.cardTarget}</span>
            <strong>{round.pointTarget}</strong>
          </div>
          <div className="game-points" aria-label={t.gamePoints}>
            <span>{t.gamePoints}</span>
            <strong>
              <b>{game.points.human}</b>
              <i aria-hidden="true">:</i>
              <b>{game.points.ai}</b>
            </strong>
            <small>
              {t.firstToPoints} <b>{game.target}</b>
            </small>
            {game.target > match.rules.initialGameTarget && (
              <em>{t.targetExtended}</em>
            )}
          </div>
          <p>
            {t.firstPlayer}:{" "}
            {round.firstPlayer === "human" ? t.contestYou : t.contestOpponent}
          </p>
        </div>
      </section>
    </>
  );
}

export function ContestStatus({ view, t }: { view: ContestView; t: Copy }) {
  const m = view.match;
  let title = t.contestDealing;
  let detail = t.contestTurnHint;
  if (view.paused) title = t.contestPaused;
  else if (view.thinking) title = t.opponentThinking;
  else if (view.busy)
    title = m?.phase === "resolving" ? t.contestRevealing : t.contestDealing;
  else if (m?.phase === "complete") {
    title = m.winner === "human" ? t.matchWon : t.matchLost;
    detail = t.matchFinishedHint;
  } else if (m?.phase === "game-complete") {
    title = m.game.winner === "human" ? t.gameWon : t.gameLost;
    detail = t.nextGameHint;
  } else if (m?.phase === "round-complete") {
    title =
      m.round.result?.winner === "human"
        ? t.roundWon
        : m.round.result?.winner === "ai"
          ? t.roundLost
          : t.roundTied;
    detail =
      m.round.result?.winner === null ? t.roundTieHint : t.roundPointHint;
  } else if (m?.round.turn?.player === "human") title = t.contestYourTurn;
  else if (m) title = t.opponentThinking;
  return (
    <div
      className="contest-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
