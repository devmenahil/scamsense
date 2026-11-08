"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";
import { Button, type ButtonVariant } from "./Button";

/**
 * Modal built on the native <dialog> element: the browser provides focus trapping, Esc to close, inert background,
 * and returns focus to the opener. Controlled via `open`/`onClose`.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hide the corner close button (Esc and footer actions still close). */
  hideCloseButton?: boolean;
}

const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideCloseButton,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-panel border-2 border-teal bg-white p-0 text-teal shadow-float",
        "max-h-[calc(100dvh-2rem)] overflow-y-auto",
        widths[size],
      )}
    >
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-subheading font-bold">
            {title}
          </h2>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-pill text-teal hover:bg-mist"
            >
              <Icon name="close" className="size-5" />
            </button>
          )}
        </div>
        {description && (
          <p id={descId} className="mt-2 text-teal/85">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
        {footer && (
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>
        )}
      </div>
    </dialog>
  );
}

/**
 * Confirmation dialog: a Modal with a cancel and a confirm action.
 * Used for "This will be your final decision" (PRODUCT_SPEC §4.1 step 3).
 */
export function Dialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Go back",
  confirmVariant = "primary",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      size="sm"
      hideCloseButton
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
