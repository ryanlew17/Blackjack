// @req REQ-2026-026: private hand, public counts/effects and expiring input selections.
import { useEffect, useRef, useState } from "react";
import type {
  ContestTrumpAction,
  ContestView,
} from "../../../application/contest/types";
import type { Copy } from "../../i18n";
import { TrumpChooser } from "./TrumpChooser";
import {
  effectLabel,
  playerName,
  targetLabel,
  text,
  trumpDescription,
  trumpName,
} from "./trumpView";

export function ContestTrumps({
  view,
  t,
  send,
}: {
  view: ContestView;
  t: Copy;
  send: (action: ContestTrumpAction) => boolean;
}) {
  const [selection, setSelection] = useState<{
    id: string;
    inputId: number;
  } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const summary = useRef<HTMLElement | null>(null);
  const match = view.match,
    trumps = match?.round.trumps;
  const selected =
    selection &&
    !view.busy &&
    !view.paused &&
    selection.inputId === view.inputId
      ? trumps?.ownHand.find((c) => c.instanceId === selection.id)
      : undefined;
  const close = () => setSelection(null);
  useEffect(() => {
    if (selection && !selected) setSelection(null);
    if (!selected && document.activeElement === document.body) {
      if (trigger.current?.isConnected && !trigger.current.disabled)
        trigger.current.focus();
      else if (trigger.current) summary.current?.focus();
    }
  }, [selected, selection]);
  if (!match || !trumps) return null;
  return (
    <section className="contest-trumps" aria-label={t.trumpArea}>
      <details className="trump-hand-panel">
        <summary ref={summary}>
          <span>
            {t.trumpHand} <b>{trumps.ownHand.length}/8</b>
          </span>
          <span>
            {t.trumpOpponentCount} <b>{trumps.opponentHandCount}</b>
          </span>
        </summary>
        <p className="trump-inventory">
          {text(t.trumpStocks, {
            own: trumps.stockCounts.human,
            opponent: trumps.stockCounts.ai,
          })}
        </p>
        <p className="small-note">{t.trumpHandHint}</p>
        <div className="trump-hand-grid">
          {trumps.ownHand.map((instance) => {
            const available = view.trumpCommands.some(
              (c) => c.instanceId === instance.instanceId,
            );
            return (
              <button
                key={instance.instanceId}
                className={`trump-card${available ? " trump-ready" : ""}`}
                disabled={view.busy || view.paused}
                aria-haspopup="dialog"
                onClick={(e) => {
                  trigger.current = e.currentTarget;
                  setSelection({
                    id: instance.instanceId,
                    inputId: view.inputId,
                  });
                }}
              >
                <strong>{trumpName(instance.definitionId, t)}</strong>
                <small>{trumpDescription(instance.definitionId, t)}</small>
                <span>{available ? t.trumpAvailable : t.trumpReadOnly}</span>
              </button>
            );
          })}
        </div>
        {!trumps.ownHand.length && (
          <p className="small-note">{t.trumpEmptyHand}</p>
        )}
      </details>
      <details className="trump-effects-panel">
        <summary>
          {t.trumpTable}{" "}
          <b>
            {trumps.table.filter((e) => e.owner === "human").length}/5 ·{" "}
            {trumps.table.filter((e) => e.owner === "ai").length}/5
          </b>
        </summary>
        <p className="small-note">{t.trumpTableHint}</p>
        {(["human", "ai"] as const).map((owner) => (
          <section
            key={owner}
            className="trump-table-side"
            aria-label={playerName(owner, t)}
          >
            <h3>{playerName(owner, t)}</h3>
            <ol className="trump-effect-list">
              {trumps.table
                .filter((e) => e.owner === owner)
                .map((effect) => (
                  <li
                    key={effect.effectId}
                    className={effect.suppressed ? "trump-suppressed" : ""}
                  >
                    <strong>{effectLabel(effect, match, t)}</strong>
                    <p>{trumpDescription(effect.definitionId, t)}</p>
                    {effect.suppressed && (
                      <b className="effect-warning">{t.trumpSuppressed}</b>
                    )}
                    {effect.targetEffectId && (
                      <span>
                        {text(t.trumpBoundTarget, {
                          target: targetLabel(effect.targetEffectId, match, t),
                        })}
                      </span>
                    )}
                    {effect.cardId && (
                      <span>
                        {text(t.trumpBoundTarget, {
                          target: targetLabel(effect.cardId, match, t),
                        })}
                      </span>
                    )}
                    {effect.expiresAfterTurn !== undefined && (
                      <span>
                        {text(t.trumpExpiry, {
                          player: playerName(effect.affectedPlayer!, t),
                          turn: effect.expiresAfterTurn,
                        })}
                      </span>
                    )}
                    {effect.watchedTurn !== undefined && (
                      <span>
                        {text(t.trumpWatch, { turn: effect.watchedTurn })}
                      </span>
                    )}
                    {effect.copiedDefinitionId && (
                      <span>
                        {text(t.trumpRecorded, {
                          name: trumpName(effect.copiedDefinitionId, t),
                        })}
                      </span>
                    )}
                    {effect.remainingCharges !== undefined && (
                      <span>
                        {text(t.trumpCharges, {
                          count: effect.remainingCharges,
                        })}
                      </span>
                    )}
                  </li>
                ))}
            </ol>
            {!trumps.table.some((e) => e.owner === owner) && (
              <p className="small-note">{t.trumpEmptyTable}</p>
            )}
          </section>
        ))}
      </details>
      {match.round.peek && (
        <aside className="trump-private-note" role="status">
          <strong>{t.trumpPeek}</strong> {match.round.peek.join(" · ")}
          <small>{t.trumpPeekHint}</small>
        </aside>
      )}
      {selected && (
        <TrumpChooser
          key={`${selection!.id}-${selection!.inputId}`}
          instance={selected}
          commands={view.trumpCommands.filter(
            (c) => c.instanceId === selected.instanceId,
          )}
          unavailableReason={
            selected.definitionId === "regret" &&
            !match.round.lastPlay &&
            view.recentEvents.some(
              (e) =>
                e.state.roundNumber === match.roundNumber &&
                e.type === "round" &&
                e.event.type === "undo-window-closed",
            )
              ? t.trumpUndoBoundary
              : undefined
          }
          match={match}
          t={t}
          close={close}
          send={send}
        />
      )}
    </section>
  );
}
