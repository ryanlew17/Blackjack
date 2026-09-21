import type { Settings } from "../../../infrastructure/save";
import type { Copy } from "../../i18n";

export function SettingsPanel({
  t,
  settings,
  conflict,
  updateSettings,
  onNewGame,
}: {
  t: Copy;
  settings: Settings;
  conflict: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  onNewGame: () => void;
}) {
  return (
    <div className="settings-list">
      <label>
        {t.language}
        <select
          value={settings.language}
          onChange={(e) =>
            updateSettings({ language: e.target.value as "zh" | "en" })
          }
        >
          <option value="en">English</option>
          <option value="zh">简体中文</option>
        </select>
      </label>
      <label>
        {t.sound}
        <button
          className="toggle"
          aria-pressed={!settings.muted}
          onClick={() => updateSettings({ muted: !settings.muted })}
        >
          {settings.muted ? t.off : t.on}
        </button>
      </label>
      <label>
        {t.volume}
        <input
          type="range"
          min="0"
          max="1"
          step=".05"
          value={settings.volume}
          onChange={(e) => updateSettings({ volume: +e.target.value })}
        />
      </label>
      <label>
        {t.motion}
        <select
          value={settings.motion}
          onChange={(e) =>
            updateSettings({
              motion: e.target.value as typeof settings.motion,
            })
          }
        >
          <option value="system">{t.system}</option>
          <option value="reduce">{t.reduce}</option>
          <option value="full">{t.full}</option>
        </select>
      </label>
      <button className="danger-link" disabled={conflict} onClick={onNewGame}>
        {t.newGame}
      </button>
    </div>
  );
}
