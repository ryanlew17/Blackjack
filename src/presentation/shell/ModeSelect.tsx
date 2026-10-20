// @req REQ-2026-018: a fresh visit always starts at the mode entrance.
import type { Copy } from "../i18n";
import { Icon } from "../shared/Icon";

export function ModeSelect({
  t,
  onClassic,
  onContest,
}: {
  t: Copy;
  onClassic: () => void;
  onContest: () => void;
}) {
  return (
    <main className="mode-select">
      <section className="home-intro">
        <div className="eyebrow">
          <span className="status-dot" />
          {t.homeEyebrow}
        </div>
        <h1 tabIndex={-1}>{t.homeTitle}</h1>
        <p>{t.homeIntro}</p>
      </section>
      <div className="mode-grid">
        <section className="mode-card classic-entry">
          <div className="mode-art classic-art" aria-hidden="true">
            <span className="art-card">
              A<small>♠</small>
            </span>
            <span className="art-card">
              K<small>♠</small>
            </span>
          </div>
          <div className="eyebrow">{t.classicTag}</div>
          <h2>{t.classicMode}</h2>
          <p>{t.classicIntro}</p>
          <button className="secondary" onClick={onClassic}>
            {t.enterClassic}
            <Icon name="arrow" />
          </button>
          <small>{t.classicSavedHint}</small>
        </section>
        <section className="mode-card contest-entry">
          <div className="mode-art contest-art" aria-hidden="true">
            <span className="art-orbit" />
            <span className="art-number">21</span>
            <span className="art-number-small">11</span>
          </div>
          <div className="eyebrow">{t.contestTag}</div>
          <h2>{t.contestMode}</h2>
          <p>{t.contestIntro}</p>
          <button className="primary" onClick={onContest}>
            {t.startContest}
            <Icon name="arrow" />
          </button>
          <small>{t.contestMemoryHint}</small>
        </section>
      </div>
      <footer className="home-footer">
        <span aria-hidden="true">♠</span>
        {t.homeFooter}
      </footer>
    </main>
  );
}
