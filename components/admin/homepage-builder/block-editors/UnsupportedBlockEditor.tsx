"use client";

/**
 * components/admin/homepage-builder/block-editors/UnsupportedBlockEditor.tsx
 *
 * Graceful fallback editor for block types that do not yet have a rich
 * Inspector editor (e.g. data-driven blocks like newsTeaser, eventsTeaser).
 *
 * Guides the editor to use List Mode for configuration of these blocks.
 */

import { Blocks, Info, List } from "lucide-react";
import { getBlockDefinition } from "@/lib/homepage/block-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  type: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// UnsupportedBlockEditor
// ---------------------------------------------------------------------------

// config and onChange are part of the BlockEditorProps interface but not used
// in this fallback — editing happens in List Mode for unsupported block types.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function UnsupportedBlockEditor({ type, config: _config, onChange: _onChange }: Props) {
  const def = getBlockDefinition(type);

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Block icon + title */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <Blocks className="h-4 w-4 text-[var(--muted)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {def?.displayName ?? type}
          </p>
          <p className="text-xs text-[var(--muted)] font-mono mt-0.5">{type}</p>
        </div>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-2)]">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--muted)]" />
        <span>
          Für diesen Block-Typ ist noch kein Rich-Editor im Inspector
          verfügbar. Bitte wechsle in den{" "}
          <strong className="font-medium">Listen-Modus</strong>, um die
          Konfiguration anzupassen.
        </span>
      </div>

      {/* Hint */}
      {def?.datadriven && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
          <List className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="font-medium">Datengesteuert</strong> — Inhalte
            werden automatisch aus der Datenbank geladen. Konfigurierbar sind
            Anzahl der Einträge und Überschrift.
          </span>
        </div>
      )}
    </div>
  );
}
