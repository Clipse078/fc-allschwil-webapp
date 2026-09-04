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

export type SheetProps = {
  /** Controls visibility. */
  open: boolean;
  /** Called when the sheet requests to be closed (Escape, backdrop click, X button). */
  onClose: () => void;
  /** Sheet heading. */
  title: string;
  /** Optional supporting text rendered below the title. */
  description?: string;
  /** Sheet body content — scrolls independently. */
  children?: ReactNode;
  /** Optional footer slot — typically holds action buttons. Sticky at bottom. */
  footer?: ReactNode;
};

/**
 * Sheet
 *
 * Right-side workspace overlay panel for full-featured editing flows.
 * Renders at ~750px desktop width with near-full viewport height, allowing
 * the page behind it to remain visible for context.
 *
 * - Accessible: focus-trapped, Escape to close, role="dialog" + aria-modal.
 * - Scrollable body, sticky header + footer.
 * - Closes on Escape key or backdrop click.
 * - Responsive: full-width on small screens.
 *
 * Usage:
 *   <Sheet
 *     open={isOpen}
 *     onClose={() => setOpen(false)}
 *     title="Planung bearbeiten"
 *     footer={<><Button onClick={onClose}>Abbrechen</Button><Button onClick={onSave}>Speichern</Button></>}
 *   >
 *     {editor content}
 *   </Sheet>
 */
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    } else {
      previousFocusRef.current?.focus();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
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
      const last = focusable[focusable.length - 1];

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
    if (e.key === "Escape") e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      role="presentation"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sce-sheet-title"
        aria-describedby={description ? "sce-sheet-desc" : undefined}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={cn(
          "relative z-10 flex flex-col",
          // Width: 750px on desktop, full-width on mobile
          "w-full sm:w-[750px] lg:w-[820px]",
          // Full viewport height
          "h-full max-h-screen",
          "border-l border-[var(--border)] bg-[var(--surface)]",
          "shadow-[var(--shadow-xl)]",
          "outline-none",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="sce-sheet-title"
              className="text-base font-semibold text-[var(--foreground)]"
            >
              {title}
            </h2>
            {description && (
              <p
                id="sce-sheet-desc"
                className="mt-1 text-sm text-[var(--text-2)]"
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label="Schließen"
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

        {/* Body — independently scrollable */}
        {children !== undefined && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm text-[var(--text-2)]">
            {children}
          </div>
        )}

        {/* Footer — sticky at bottom */}
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
