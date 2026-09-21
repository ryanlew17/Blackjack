import type { Copy } from "../../i18n";

export function ResetPanel({
  t,
  conflict,
  onConfirm,
  onCancel,
}: {
  t: Copy;
  conflict: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <p className="modal-intro">{t.resetCopy}</p>
      <div className="modal-actions">
        <button className="primary" disabled={conflict} onClick={onConfirm}>
          {t.confirmReset}
        </button>
        <button className="secondary" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </>
  );
}
