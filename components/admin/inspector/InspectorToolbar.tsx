"use client";

/**
 * components/admin/inspector/InspectorToolbar.tsx
 *
 * Top toolbar strip for the inspector panel. Displays:
 *   - Section label + block type badge
 *   - Autosave indicator (idle / saving / saved / error)
 *   - Close button
 *
 * Usage:
 *   <InspectorToolbar
 *     label="Hero-Bereich"
 *     blockType="hero"
 *     saveState="saved"
 *     lastSaved={date}
 *     onClose={…}
 *   />
 */

import { X, RefreshCw, Check, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InspectorSaveState = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type InspectorToolbarProps = {
  /** Block section label (editable name). */
  label: string;
  /** Human-readable block type display name. */
  blockDisplayName?: string;
  saveState: InspectorSaveState;
  lastSaved: Date | null;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InspectorToolbar({
  label,
  blockDisplayName,
  saveState,
  lastSaved,
  onClose,
}: InspectorToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{label}</p>
        {blockDisplayName && (
          <p className="text-[10px] text-[var(--muted)]">{blockDisplayName}</p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {/* Autosave indicator */}
        {saveState === "saving" && (
          <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
            Speichern…
          </span>
        )}
        {saveState === "saved" && (
          <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
            <Check className="h-3 w-3 text-emerald-500" />
            {lastSaved
              ? lastSaved.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
              : "Gespeichert"}
          </span>
        )}
        {saveState === "error" && (
          <span className="flex items-center gap-1 text-[11px] text-rose-600">
            <AlertCircle className="h-3 w-3" />
            Fehler
          </span>
        )}

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="sce-icon-button"
          title="Inspector schliessen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
