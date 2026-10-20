// @req REQ-2026-018: input legality and outcomes belong to the application.
import type {
  ContestAction,
  ContestView,
} from "../../../application/contest/types";
import type { Copy } from "../../i18n";
import { ContestStatus } from "./ContestTable";
import { Icon } from "../../shared/Icon";

export function ContestControls({
  view,
  t,
  send,
  onRestart,
}: {
  view: ContestView;
  t: Copy;
  send: (action: ContestAction) => boolean;
  onRestart: () => void;
}) {
  const complete = view.match?.phase === "complete";
  const between =
    view.match?.phase === "round-complete" ||
    view.match?.phase === "game-complete";
  const can = (action: ContestAction) =>
    !view.busy && !view.paused && view.actions.includes(action);
  return (
    <section className="contest-controls" aria-label={t.contestActions}>
      <ContestStatus view={view} t={t} />
      <div className="contest-action-row">
        {complete ? (
          <button
            className="primary"
            disabled={view.busy || view.paused}
            onClick={onRestart}
          >
            {t.contestRestart}
            <Icon name="arrow" />
          </button>
        ) : between ? (
          <button
            className="primary"
            disabled={!can("NextRound")}
            onClick={() => send("NextRound")}
          >
            {view.match?.phase === "game-complete"
              ? t.nextContestGame
              : t.nextContestRound}
            <Icon name="arrow" />
          </button>
        ) : (
          <>
            <button
              className="primary"
              disabled={!can("Hit")}
              onClick={() => send("Hit")}
            >
              {t.hit}
              <span aria-hidden="true">＋</span>
            </button>
            <button
              className="secondary"
              disabled={!can("Stay")}
              onClick={() => send("Stay")}
            >
              {t.contestStay}
              <span aria-hidden="true">—</span>
            </button>
          </>
        )}
      </div>
      {!complete && (
        <button className="contest-restart-link" onClick={onRestart}>
          {t.contestRestart}
        </button>
      )}
    </section>
  );
}
