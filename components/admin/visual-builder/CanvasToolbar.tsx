"use client";

/**
 * components/admin/visual-builder/CanvasToolbar.tsx
 *
 * Floating action toolbar shown when a section frame is selected.
 *
 * Actions (German labels per UX spec):
 *   Bearbeiten   — open config editor for this section
 *   Duplizieren  — duplicate section
 *   Nach oben    — move section up
 *   Nach unten   — move section down
 *   Löschen      — delete section
 */

import { Pencil, Copy, ChevronUp, ChevronDown, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CanvasToolbarProps = {
  sectionId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  actionPending: boolean;
  onEdit: () => void;
  onDuplicate?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

// ---------------------------------------------------------------------------
// CanvasToolbar
// ---------------------------------------------------------------------------

export default function CanvasToolbar({
  canMoveUp,
  canMoveDown,
  actionPending,
  onEdit,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1 py-1 shadow-md">
      {/* Bearbeiten */}
      <ToolbarButton
        onClick={onEdit}
        title="Abschnitt bearbeiten"
        disabled={actionPending}
        variant="primary"
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Bearbeiten</span>
      </ToolbarButton>

      <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />

      {/* Nach oben */}
      <ToolbarButton
        onClick={onMoveUp}
        title="Nach oben"
        disabled={actionPending || !canMoveUp}
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Nach unten */}
      <ToolbarButton
        onClick={onMoveDown}
        title="Nach unten"
        disabled={actionPending || !canMoveDown}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </ToolbarButton>

      {onDuplicate && (
        <>
          <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
          {/* Duplizieren */}
          <ToolbarButton
            onClick={onDuplicate}
            title="Duplizieren"
            disabled={actionPending}
          >
            <Copy className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}

      <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />

      {/* Löschen */}
      <ToolbarButton
        onClick={onDelete}
        title="Löschen"
        disabled={actionPending}
        variant="danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolbarButton — shared button primitive
// ---------------------------------------------------------------------------

type ToolbarButtonProps = {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  children: React.ReactNode;
};

function ToolbarButton({
  onClick,
  title,
  disabled = false,
  variant = "default",
  children,
}: ToolbarButtonProps) {
  const colorClass =
    variant === "primary"
      ? "text-blue-600 hover:bg-blue-50"
      : variant === "danger"
        ? "text-rose-500 hover:bg-rose-50 hover:text-rose-700"
        : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${colorClass}`}
    >
      {children}
    </button>
  );
}
