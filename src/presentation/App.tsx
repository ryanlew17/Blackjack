import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { useSystemReducedMotion } from "./shared/useSystemReducedMotion";
import { useContest } from "../application/contest/useContest";
import { ModeSelect } from "./shell/ModeSelect";
import { ContestTable } from "./contest/table/ContestTable";
import { ContestControls } from "./contest/table/ContestControls";
import { ContestRules } from "./contest/table/ContestRules";
import { useGame } from "../application/classic/useGame";
import { legalActions, type GameCommand } from "../domain/classic/game";
import type { SaveEnvelope } from "../infrastructure/classic/save";
import { ControlDeck } from "./classic/components/ControlDeck";
import { GameTable } from "./classic/components/GameTable";
import { Icon } from "./shared/Icon";
import { Modal } from "./shared/Modal";
import { HistoryPanel } from "./classic/components/panels/HistoryPanel";
import { ResetPanel } from "./classic/components/panels/ResetPanel";
import { RulesPanel } from "./classic/components/panels/RulesPanel";
import { SavesPanel } from "./classic/components/panels/SavesPanel";
import { AboutPanel } from "./classic/components/panels/AboutPanel";
import { SettingsPanel } from "./classic/components/panels/SettingsPanel";
import { formatChips } from "./classic/format";
import { en, zh } from "./i18n";

type Mode = "home" | "classic" | "contest";
type Panel =
  | "about"
  | "rules"
  | "settings"
  | "saves"
  | "history"
  | "reset"
  | "leaveContest"
  | "restartContest";

export default function App() {
  const systemReduced = useSystemReducedMotion();
  const api = useGame(systemReduced),
    { game: g, settings } = api;
  // @req REQ-2026-018: settings/classic progress survive mode changes; matches do not.
  const contest = useContest({ settings, systemReduced });
  const [mode, setMode] = useState<Mode>("home");
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current !== mode) {
      document.querySelector<HTMLElement>("main h1")?.focus();
      previousMode.current = mode;
    }
  }, [mode]);
  const t = settings.language === "zh" ? zh : en;
  const reduced =
    settings.motion === "reduce" ||
    (settings.motion === "system" && systemReduced);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [pending, setPending] = useState<SaveEnvelope | null>(null);
  const [focusAbout, setFocusAbout] = useState(false);
  const actions = legalActions(g);
  const blocked =
    api.busy ||
    api.conflict ||
    api.problem === "corrupt" ||
    api.problem === "version";
  const can = (action: GameCommand["type"]) =>
    !blocked && actions.includes(action);
  useEffect(() => {
    document.documentElement.lang = settings.language === "zh" ? "zh-CN" : "en";
  }, [settings.language]);
  const closePanel = () => {
    setPanel(null);
    setPending(null);
    setFocusAbout(false);
    contest.resume();
  };
  const openPanel = (next: Panel) => {
    if (mode === "contest") contest.pause();
    setPanel(next);
  };
  const goHome = () => {
    if (mode === "contest" && contest.match?.phase !== "complete") {
      openPanel("leaveContest");
    } else {
      contest.exit();
      setMode("home");
    }
  };
  const restartContest = () => {
    if (contest.match?.phase === "complete" && panel === null)
      contest.restart();
    else openPanel("restartContest");
  };
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">♠</span>
            <span>
              <strong>
                BLACKJACK<span className="brand-dot">.</span>
              </strong>
              <small>{t.room}</small>
            </span>
          </div>
          <nav aria-label={t.settings}>
            {mode !== "home" && (
              <button className="rules-link" onClick={() => openPanel("rules")}>
                {t.rules}
                <span>↗</span>
              </button>
            )}
            <span className="nav-divider" />
            <button
              className="icon-button"
              aria-label={t.muted}
              aria-pressed={settings.muted}
              onClick={() => api.updateSettings({ muted: !settings.muted })}
            >
              <Icon name={settings.muted ? "mute" : "sound"} />
            </button>
            {mode === "classic" && (
              <button
                className="icon-button"
                aria-label={t.saves}
                onClick={() => openPanel("saves")}
              >
                <Icon name="save" />
              </button>
            )}
            <button
              className="icon-button"
              aria-label={t.settings}
              onClick={() => openPanel("settings")}
            >
              <Icon name="settings" />
            </button>
          </nav>
        </header>
        {mode === "home" && (
          <ModeSelect
            t={t}
            onClassic={() => setMode("classic")}
            onContest={() => {
              contest.start();
              setMode("contest");
            }}
          />
        )}
        {mode === "classic" && (
          <main>
            <div className="mode-breadcrumb">
              <button onClick={goHome}>
                <span aria-hidden="true">←</span>
                {t.backHome}
              </button>
              <span>{t.classicMode}</span>
            </div>
            <section className="table-heading">
              <div>
                <div className="eyebrow">
                  <span className="status-dot" />
                  {t.live}
                </div>
                <h1 tabIndex={-1}>{t.subtitle}</h1>
              </div>
              <div className="bankroll">
                <span className="eyebrow">{t.wallet}</span>
                <div>
                  <span className="currency-mark">◈</span>
                  <span data-testid="balance">
                    {formatChips(g.balance, settings.language)}
                  </span>
                </div>
              </div>
            </section>
            {(api.problem || api.conflict) && (
              <aside className="notice" role="alert">
                <span>
                  {api.conflict
                    ? t.conflict
                    : api.problem === "corrupt" || api.problem === "version"
                      ? api.problem === "version"
                        ? t.legacySave
                        : t.corrupt
                      : t.storage}
                </span>
                {api.conflict ? (
                  <button onClick={api.reloadLatest}>{t.reload}</button>
                ) : (
                  <>
                    <button onClick={() => openPanel("saves")}>
                      {t.saves}
                    </button>
                    {(api.problem === "corrupt" ||
                      api.problem === "version") && (
                      <button onClick={() => openPanel("reset")}>
                        {t.newGame}
                      </button>
                    )}
                  </>
                )}
              </aside>
            )}
            <GameTable
              game={g}
              effect={api.effect}
              effectId={api.effectId}
              reduced={reduced}
              t={t}
              language={settings.language}
              onShowHistory={() => openPanel("history")}
            />
            <ControlDeck
              game={g}
              busy={api.busy}
              can={can}
              send={api.send}
              t={t}
              language={settings.language}
              onNewGame={() => openPanel("reset")}
              onOpenSaves={() => openPanel("saves")}
            />
            <footer className="page-footer">
              <span>
                {!api.problem && !api.conflict ? (
                  <>
                    <Icon name="check" />
                    {t.saved}
                  </>
                ) : (
                  t.practice
                )}
              </span>
              <span>{t.practice}</span>
              <button onClick={() => openPanel("rules")}>{t.rules} ↗</button>
            </footer>
          </main>
        )}
        {mode === "contest" && (
          <main className="contest-page">
            <div className="mode-breadcrumb">
              <button onClick={goHome}>
                <span aria-hidden="true">←</span>
                {t.backHome}
              </button>
              <span>{t.contestMode}</span>
            </div>
            <section className="contest-heading">
              <div>
                <div className="eyebrow">
                  <span className="status-dot" />
                  {t.contestTag}
                </div>
                <h1 tabIndex={-1}>{t.contestMode}</h1>
              </div>
              <button onClick={() => openPanel("rules")}>
                {t.contestRulesTitle} ↗
              </button>
            </section>
            {contest.match && (
              <ContestTable
                match={contest.match}
                busy={contest.busy}
                reduced={reduced}
                t={t}
              />
            )}
            <ContestControls
              view={contest}
              t={t}
              send={contest.send}
              onRestart={restartContest}
            />
            <footer className="contest-footer">{t.contestMemoryHint}</footer>
          </main>
        )}
        {panel && (
          <Modal
            closeLabel={t.close}
            title={
              panel === "rules"
                ? mode === "contest"
                  ? t.contestRulesTitle
                  : t.rulesTitle
                : panel === "leaveContest"
                  ? t.leaveContestTitle
                  : panel === "restartContest"
                    ? t.restartContestTitle
                    : panel === "reset"
                      ? t.resetTitle
                      : t[panel]
            }
            close={closePanel}
          >
            {panel === "rules" &&
              (mode === "contest" ? (
                <ContestRules t={t} />
              ) : (
                <RulesPanel t={t} />
              ))}
            {panel === "settings" && (
              <SettingsPanel
                t={t}
                settings={settings}
                conflict={mode === "contest" ? false : api.conflict}
                focusAbout={focusAbout}
                updateSettings={api.updateSettings}
                onNewGame={
                  mode === "home"
                    ? undefined
                    : mode === "contest"
                      ? restartContest
                      : () => openPanel("reset")
                }
                newGameLabel={mode === "contest" ? t.contestRestart : undefined}
                onAbout={() => setPanel("about")}
              />
            )}
            {panel === "about" && (
              <AboutPanel
                t={t}
                onBack={() => {
                  setFocusAbout(true);
                  setPanel("settings");
                }}
              />
            )}
            {panel === "saves" && (
              <SavesPanel
                t={t}
                language={settings.language}
                snapshot={api.snapshot}
                conflict={api.conflict}
                problem={api.problem}
                pending={pending}
                onPending={setPending}
                onConfirmImport={() => {
                  if (pending) api.replace(pending);
                  closePanel();
                }}
                onCancelImport={() => setPending(null)}
              />
            )}
            {panel === "history" && (
              <HistoryPanel
                t={t}
                language={settings.language}
                history={g.history}
              />
            )}
            {(panel === "leaveContest" || panel === "restartContest") && (
              <>
                <p className="modal-intro">
                  {panel === "leaveContest"
                    ? t.leaveContestBody
                    : t.restartContestBody}
                </p>
                <div className="modal-actions">
                  <button className="secondary" autoFocus onClick={closePanel}>
                    {t.keepPlaying}
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      if (panel === "leaveContest") {
                        contest.exit();
                        setMode("home");
                      } else contest.restart();
                      closePanel();
                    }}
                  >
                    {panel === "leaveContest"
                      ? t.confirmLeaveContest
                      : t.contestRestart}
                  </button>
                </div>
              </>
            )}
            {panel === "reset" && (
              <ResetPanel
                t={t}
                conflict={api.conflict}
                onConfirm={() => {
                  api.reset();
                  closePanel();
                }}
                onCancel={closePanel}
              />
            )}
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}
