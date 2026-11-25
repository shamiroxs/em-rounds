"use client";

import { useEffect, useRef } from "react";

/**
 * Accessible confirmation dialog built on the native <dialog> element
 * (focus trapping and Escape handling come from the browser).
 * Use it before every destructive or publishing action.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="confirm-title" className="section-title" style={{ fontSize: "1.15rem" }}>
        {title}
      </h2>
      <div className="muted-copy admin-dialog-body">{description}</div>
      <div className="admin-dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={destructive ? "primary-button admin-danger" : "primary-button"}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
