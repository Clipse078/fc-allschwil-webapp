"use client";

/**
 * components/admin/visual-builder/CanvasInsertionZone.tsx
 *
 * Visual insertion target between sections on the page builder canvas.
 *
 * Renders as a subtle horizontal rule with a centred "+" button.
 * On hover:  line turns blue, button label expands.
 * On click:  calls onInsert() so the parent can open AddSectionPanel at
 *            the corresponding position.
 *
 * Accessibility:
 *   - Focusable with Tab; activates on Enter or Space.
 *   - aria-label describes the action and position for screen readers.
 */

import { useState } from "react";
import { Plus } from "lucide-react";

type Props = {
  /** Fired when the editor wants to insert a section at this position. */
  onInsert: () => void;
  /** Human-readable label for screen readers (e.g. "Block nach Sektion 2 einfügen"). */
  ariaLabel?: string;
};

export default function CanvasInsertionZone({
  onInsert,
  ariaLabel = "Block hinzufügen",
}: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center transition-all"
      style={{ padding: hovered ? "6px 0" : "2px 0" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Horizontal rule */}
      <div
        className={`absolute inset-x-4 h-px rounded transition-colors ${
          hovered ? "bg-blue-400" : "bg-[var(--border)]"
        }`}
      />

      {/* Insert button */}
      <button
        type="button"
        onClick={onInsert}
        aria-label={ariaLabel}
        className={`
          relative z-10 flex items-center gap-1.5 rounded-full border px-3 py-1
          text-xs font-medium transition-all
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
          ${
            hovered
              ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-blue-300 hover:text-blue-600"
          }
        `}
      >
        <Plus className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        <span className={`overflow-hidden transition-all ${hovered ? "max-w-32" : "max-w-0"}`}>
          Block hinzufügen
        </span>
      </button>
    </div>
  );
}
