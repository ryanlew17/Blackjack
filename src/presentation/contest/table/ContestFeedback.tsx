// @req REQ-2026-026: narrate projected facts; never infer hidden failures or calculate awards.
import type { ContestView } from "../../../application/contest/types";
import type { MatchEventView } from "../../../domain/contest/engine";
import type { Copy } from "../../i18n";
import { playerName, text, trumpName } from "./trumpView";

export function feedbackMessage(event: MatchEventView, t: Copy): string | null {
  if (event.type === "round-scored")
    return text(t.trumpScoreAward, {
      player: event.winner ? playerName(event.winner, t) : t.roundTied,
      points: event.score.increment,
    });
  if (event.type === "round-cleanup") return t.trumpRoundCleanup;
  if (event.type === "game-cleanup") return t.trumpGameCleanup;
  if (event.type === "target-extended")
    return text(t.trumpTargetExtended, { target: event.to });
  if (event.type !== "round") return null;
  const e = event.event;
  if (e.type === "undo-window-closed") return t.trumpUndoBoundary;
  if (e.type === "table-effect")
    return e.operation === "removed"
      ? t.trumpEffectRemoved
      : t.trumpEffectUpdated;
  if (e.type === "resource") {
    const player = playerName(e.player, t);
    if (e.operation === "blocked")
      return text(t.trumpSupplyBlocked, { player });
    if (e.operation === "delete") {
      if (e.definitionId)
        return text(e.instance ? t.trumpStockDeleted : t.trumpStockMiss, {
          name: trumpName(e.definitionId, t),
        });
      return text(t.trumpCostPaid, {
        player,
        name: e.instance
          ? trumpName(e.instance.definitionId, t)
          : t.trumpUnknown,
      });
    }
    // Null on an opponent's private resource event is a privacy mask, not a failed draw.
    if (e.player !== "human" && !e.instance)
      return text(t.trumpOpponentSupply, { player });
    if (!e.instance) return text(t.trumpSupplyZero, { player });
    return text(
      e.operation === "generate"
        ? t.trumpGenerated
        : e.operation === "transfer"
          ? t.trumpTransferred
          : t.trumpReceived,
      {
        player,
        name: trumpName(e.instance.definitionId, t),
      },
    );
  }
  if (e.type !== "trump") return null;
  const name = trumpName(e.instance.definitionId, t);
  const templates = {
    played: t.trumpPlayed,
    draw: e.card === null ? t.trumpDrawMiss : t.trumpDrawn,
    return: t.trumpReturned,
    placed: t.trumpPlaced,
    removed: t.trumpCleared,
    "generated-number": t.trumpNumberGenerated,
    "deleted-number": t.trumpNumberDeleted,
    swapped: t.trumpSwapped,
    modified: t.trumpModified,
    revealed: t.trumpRevealed,
    peek: t.trumpPeeked,
    rotated: t.trumpRotated,
    exchanged: t.trumpExchanged,
    undone: t.trumpUndone,
    "sudden-death": t.trumpSuddenDeath,
  };
  return text(templates[e.effect], {
    name,
    player: playerName(e.player, t),
    value: e.card ?? "",
  });
}

export function ContestFeedback({ view, t }: { view: ContestView; t: Copy }) {
  const round = view.match?.roundNumber;
  const events = view.recentEvents.filter((e) => e.state.roundNumber === round);
  const messages = events.flatMap((event) => {
    const message = feedbackMessage(event, t);
    return message ? [message] : [];
  });
  const last = messages.at(-1);
  const scored = [...events]
    .reverse()
    .find(
      (e): e is Extract<MatchEventView, { type: "round-scored" }> =>
        e.type === "round-scored",
    );
  return (
    <section className="contest-feedback" aria-label={t.trumpFeedback}>
      <p className="trump-latest" role="status" aria-live="polite">
        {last ?? t.trumpFeedbackHint}
      </p>
      {scored && (
        <div className="trump-score-breakdown">
          <strong>
            {text(t.trumpScoreAward, {
              player: scored.winner
                ? playerName(scored.winner, t)
                : t.roundTied,
              points: scored.score.increment,
            })}
          </strong>
          <dl>
            {(
              [
                [t.trumpScoreBase, scored.score.base],
                [t.trumpScoreAttack, scored.score.attack],
                [t.trumpScoreDefense, scored.score.defense],
                [t.trumpScoreBonus, scored.score.bonus],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {scored.score.guarded && <p>{t.trumpScoreGuarded}</p>}
          {scored.score.ceasefire && <p>{t.trumpScoreCeasefire}</p>}
          <ul>
            {scored.score.modifiers.map((m) => {
              const effect = scored.state.round.trumps?.table.find(
                (e) => e.effectId === m.effectId,
              );
              return (
                <li key={m.effectId}>
                  {playerName(m.owner, t)} ·{" "}
                  {effect ? trumpName(effect.definitionId, t) : t.trumpUnknown}{" "}
                  · {m.amount > 0 ? `+${m.amount}` : m.amount}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {messages.length > 0 && (
        <details className="trump-activity">
          <summary>{t.trumpActivity}</summary>
          <ol>
            {messages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
