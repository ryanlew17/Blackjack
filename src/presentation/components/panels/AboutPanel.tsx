import { useEffect, useRef } from "react";
import type { Copy } from "../../i18n";

const repository = "https://github.com/ryanlew17/Blackjack";

// @req REQ-2026-007: a secondary view inside the existing settings modal.
export function AboutPanel({ t, onBack }: { t: Copy; onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);

  return (
    <div className="about-panel">
      <button ref={back} className="about-back" onClick={onBack}>
        <span aria-hidden="true">← </span>
        {t.backToSettings}
      </button>
      <dl className="about-details">
        <div>
          <dt>{t.appVersion}</dt>
          <dd>{__APP_VERSION__}</dd>
        </div>
        <div>
          <dt>{t.repository}</dt>
          <dd>
            <a href={repository} target="_blank" rel="noopener">
              {repository}
            </a>
          </dd>
        </div>
        <div>
          <dt>{t.license}</dt>
          <dd>
            <a
              href={`${repository}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener"
            >
              {t.mitLicense}
            </a>
          </dd>
        </div>
      </dl>
      <h3>{t.feedback}</h3>
      <p>{t.feedbackHint}</p>
      <a href={`${repository}/issues`} target="_blank" rel="noopener">
        {t.openIssues}
      </a>
    </div>
  );
}
