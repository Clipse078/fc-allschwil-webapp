"use client";

/**
 * components/admin/visual-builder/CanvasInsertionPoint.tsx
 *
 * Insertion point shown between sections and at canvas boundaries.
 * Clicking opens the block gallery / add-section panel at the given position.
 *
 * UX: invisible at rest, animates in on hover.
 */

import { Plus } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CanvasInsertionPointProps = {
  /** Index position — 0 = before first section, n = after n-th section */
  insertIndex: number;
  onInsert: (insertIndex: number) => void;
  /** Reduced visual weight for the boundary insertion points */
  variant?: "between" | "boundary";
};

// ---------------------------------------------------------------------------
// CanvasInsertionPoint
// ---------------------------------------------------------------------------

export default function CanvasInsertionPoint({
  insertIndex,
  onInsert,
  variant = "between",
}: CanvasInsertionPointProps) {
  return (
    <div className="group relative flex items-center py-1">
      {/* Horizontal line */}
      <div
        className={`h-px flex-1 transition-colors ${
          variant === "boundary"
            ? "bg-transparent group-hover:bg-[var(--border)]"
            : "bg-[var(--border)] opacity-0 group-hover:opacity-100"
        }`}
      />

      {/* Insert button */}
      <button
        type="button"
        onClick={() => onInsert(insertIndex)}
        title="Block hinzufügen"
        className={`relative z-10 flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-[11px] font-medium transition-all
          ${
            variant === "boundary"
              ? "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
          }
        `}
      >
        <Plus className="h-3 w-3" />
        Block hinzufügen
      </button>

      {/* Horizontal line (right) */}
      <div
        className={`h-px flex-1 transition-colors ${
          variant === "boundary"
            ? "bg-transparent group-hover:bg-[var(--border)]"
            : "bg-[var(--border)] opacity-0 group-hover:opacity-100"
        }`}
      />
    </div>
  );
}
