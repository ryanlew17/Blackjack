import { useEffect, useRef, type ReactNode } from "react";
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
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onPointerDown={(e) => {
        backdropPressed.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (backdropPressed.current && e.target === e.currentTarget) close();
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
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
