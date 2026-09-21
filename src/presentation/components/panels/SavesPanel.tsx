import { useRef, useState } from "react";
import {
  MAX_SAVE_SIZE,
  parseSave,
  SaveError,
  type Language,
  type SaveEnvelope,
} from "../../../infrastructure/save";
import { formatChips } from "../../format";
import type { Copy } from "../../i18n";
import { Icon } from "../Icon";

type FileError = SaveError["code"] | "importReadError";

export function SavesPanel({
  t,
  language,
  snapshot,
  conflict,
  pending,
  onPending,
  onConfirmImport,
  onCancelImport,
}: {
  t: Copy;
  language: Language;
  snapshot: () => SaveEnvelope;
  conflict: boolean;
  pending: SaveEnvelope | null;
  onPending: (save: SaveEnvelope) => void;
  onConfirmImport: () => void;
  onCancelImport: () => void;
}) {
  const [fileError, setFileError] = useState<FileError | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const exportSave = () => {
    const blob = new Blob([JSON.stringify(snapshot())], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `green-room-${new Date().toISOString().slice(0, 10)}.blackjack.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importSave = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    try {
      if (file.size > MAX_SAVE_SIZE) throw new SaveError("size");
      onPending(parseSave(await file.text()));
    } catch (e) {
      setFileError(e instanceof SaveError ? e.code : "importReadError");
    }
    if (input.current) input.current.value = "";
  };
  return (
    <>
      <p className="modal-intro">{t.saveCopy}</p>
      <div className="save-summary">
        <span>
          {t.balance}
          <strong>{formatChips(snapshot().game.balance, language)}</strong>
        </span>
        <span>
          {t.round}
          <strong>{snapshot().game.round}</strong>
        </span>
      </div>
      <div className="modal-actions">
        <button className="primary" onClick={exportSave}>
          {t.export}
          <Icon name="save" />
        </button>
        <button
          className="secondary"
          disabled={conflict}
          onClick={() => input.current?.click()}
        >
          {t.import}
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,.blackjack.json,application/json"
          hidden
          onChange={(e) => void importSave(e.target.files?.[0])}
        />
      </div>
      {fileError && (
        <p role="alert" className="error-text">
          {t[fileError]}
        </p>
      )}
      {pending && (
        <section className="import-preview">
          <h3>{t.importTitle}</h3>
          <p>{t.importCopy}</p>
          <dl>
            <dt>{t.balance}</dt>
            <dd>{formatChips(pending.game.balance, language)}</dd>
            <dt>{t.phase}</dt>
            <dd>{t[`${pending.game.phase}Phase`]}</dd>
            <dt>{t.fileDate}</dt>
            <dd>{new Date(pending.savedAt).toLocaleString(language)}</dd>
          </dl>
          <div className="modal-actions">
            <button
              className="primary"
              disabled={conflict}
              onClick={onConfirmImport}
            >
              {t.confirmImport}
            </button>
            <button className="secondary" onClick={onCancelImport}>
              {t.cancel}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
