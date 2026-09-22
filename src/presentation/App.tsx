import { useEffect, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { useGame } from "../application/useGame";
import { legalActions, type GameCommand } from "../domain/game";
import type { SaveEnvelope } from "../infrastructure/save";
import { ControlDeck } from "./components/ControlDeck";
import { GameTable } from "./components/GameTable";
import { Icon } from "./components/Icon";
import { Modal } from "./components/Modal";
import { HistoryPanel } from "./components/panels/HistoryPanel";
import { ResetPanel } from "./components/panels/ResetPanel";
import { RulesPanel } from "./components/panels/RulesPanel";
import { SavesPanel } from "./components/panels/SavesPanel";
import { AboutPanel } from "./components/panels/AboutPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { formatChips } from "./format";
import { en, zh } from "./i18n";

type Panel = "about" | "rules" | "settings" | "saves" | "history" | "reset";

export default function App() {
  const systemReduced = !!useReducedMotion();
  const api = useGame(systemReduced),
    { game: g, settings } = api;
  const t = settings.language === "zh" ? zh : en;
  const reduced =
    settings.motion === "reduce" ||
    (settings.motion === "system" && systemReduced);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [pending, setPending] = useState<SaveEnvelope | null>(null);
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
  };
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <div className="app-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => e.preventDefault()}
            aria-label="Blackjack — The Green Room"
          >
            <span className="brand-mark">♠</span>
            <span>
              <strong>
                BLACKJACK<span className="brand-dot">.</span>
              </strong>
              <small>{t.room}</small>
            </span>
          </a>
          <nav aria-label={t.settings}>
            <button className="rules-link" onClick={() => setPanel("rules")}>
              {t.rules}
              <span>↗</span>
            </button>
            <span className="nav-divider" />
            <button
              className="icon-button"
              aria-label={t.muted}
              aria-pressed={settings.muted}
              onClick={() => api.updateSettings({ muted: !settings.muted })}
            >
              <Icon name={settings.muted ? "mute" : "sound"} />
            </button>
            <button
              className="icon-button"
              aria-label={t.saves}
              onClick={() => setPanel("saves")}
            >
              <Icon name="save" />
            </button>
            <button
              className="icon-button"
              aria-label={t.settings}
              onClick={() => setPanel("settings")}
            >
              <Icon name="settings" />
            </button>
          </nav>
        </header>
        <main>
          <section className="table-heading">
            <div>
              <div className="eyebrow">
                <span className="status-dot" />
                {t.live}
              </div>
              <h1>{t.subtitle}</h1>
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
                  <button onClick={() => setPanel("saves")}>{t.saves}</button>
                  {(api.problem === "corrupt" || api.problem === "version") && (
                    <button onClick={() => setPanel("reset")}>
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
            onShowHistory={() => setPanel("history")}
          />
          <ControlDeck
            game={g}
            busy={api.busy}
            can={can}
            send={api.send}
            t={t}
            language={settings.language}
            onNewGame={() => setPanel("reset")}
            onOpenSaves={() => setPanel("saves")}
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
            <button onClick={() => setPanel("rules")}>{t.rules} ↗</button>
          </footer>
        </main>
        {panel && (
          <Modal
            closeLabel={t.close}
            title={
              panel === "rules"
                ? t.rulesTitle
                : panel === "reset"
                  ? t.resetTitle
                  : t[panel]
            }
            close={closePanel}
          >
            {panel === "rules" && <RulesPanel t={t} />}
            {panel === "settings" && (
              <SettingsPanel
                t={t}
                settings={settings}
                conflict={api.conflict}
                updateSettings={api.updateSettings}
                onNewGame={() => setPanel("reset")}
                onAbout={() => setPanel("about")}
              />
            )}
            {panel === "about" && (
              <AboutPanel t={t} onBack={() => setPanel("settings")} />
            )}
            {panel === "saves" && (
              <SavesPanel
                t={t}
                language={settings.language}
                snapshot={api.snapshot}
                conflict={api.conflict}
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
