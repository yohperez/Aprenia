import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { t } from "../i18n";
import { Icon } from "./Icon";

interface DialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ComponentChildren;
}

export function Dialog({ title, open, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      class="dialog"
      aria-labelledby="dialog-title"
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
    >
      <div class="dialog-body">
        <header class="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" class="icon-button" onClick={onClose} aria-label={t.value.close}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
