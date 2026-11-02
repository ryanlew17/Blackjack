import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
export function Modal({
  title,
  close,
  closeLabel,
  children,
}: {
  title: string;
  closeLabel: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPressed = useRef(false);
  // @req REQ-2026-027: programmatic closes must restore native focus before DOM removal.
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  // @req REQ-2026-027: close while still connected so native focus returns before React unmounts.
  const dismiss = () => {
    ref.current?.close();
    close();
  };
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onPointerDown={(e) => {
        backdropPressed.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (backdropPressed.current && e.target === e.currentTarget) dismiss();
        backdropPressed.current = false;
      }}
      aria-labelledby="modal-title"
    >
      <div className="dialog-body">
        <header className="dialog-head">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            aria-label={closeLabel}
            onClick={dismiss}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
