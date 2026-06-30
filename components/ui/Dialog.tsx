"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type DialogSize = "sm" | "md" | "lg";

export type DialogProps = {
  /** Controls visibility. */
  open: boolean;
  /** Called when the dialog requests to be closed (Escape, backdrop click, X button). */
  onClose: () => void;
  /** Dialog heading. */
  title: string;
  /** Optional supporting text rendered below the title. */
  description?: string;
  /** Dialog body content. */
  children?: ReactNode;
  /** Optional footer slot — typically holds action buttons. */
  footer?: ReactNode;
  /** Maximum width preset. @default "md" */
  size?: DialogSize;
};

const sizeClass: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/**
 * Dialog
 *
 * Minimal accessible modal dialog primitive.
 * No external dependency — built on native <dialog> semantics.
 *
 * - Traps focus within the dialog while open.
 * - Closes on Escape key or backdrop click.
 * - Renders into the current React tree; wrap in a portal if needed.
 *
 * Usage:
 *   <Dialog
 *     open={isOpen}
 *     onClose={() => setOpen(false)}
 *     title="Eintrag löschen"
 *     description="Diese Aktion kann nicht rückgängig gemacht werden."
 *     footer={
 *       <>
 *         <Button variant="secondary" onClick={() => setOpen(false)}>Abbrechen</Button>
 *         <Button variant="danger" onClick={handleDelete}>Löschen</Button>
 *       </>
 *     }
 *   >
 *     <p>Möchtest du diesen Eintrag wirklich löschen?</p>
 *   </Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the panel so screen readers announce the dialog
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handlePanelKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Prevent Escape from bubbling — already handled globally above
    if (e.key === "Escape") e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sce-dialog-title"
        aria-describedby={description ? "sce-dialog-desc" : undefined}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={cn(
          "relative z-10 flex w-full flex-col",
          "rounded-2xl border border-[var(--border)] bg-[var(--surface)]",
          "shadow-[var(--shadow-xl)]",
          "outline-none",
          sizeClass[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="sce-dialog-title"
              className="text-base font-semibold text-[var(--foreground)]"
            >
              {title}
            </h2>
            {description && (
              <p
                id="sce-dialog-desc"
                className="mt-1 text-sm text-[var(--text-2)]"
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label="Dialog schließen"
            onClick={onClose}
            className={cn(
              "shrink-0 rounded-lg p-1.5",
              "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
              "transition-colors duration-[120ms]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        {children !== undefined && (
          <div className="overflow-y-auto px-6 py-5 text-sm text-[var(--text-2)]">
            {children}
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
