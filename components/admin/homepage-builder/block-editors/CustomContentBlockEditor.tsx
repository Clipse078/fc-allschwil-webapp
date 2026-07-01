"use client";

/**
 * components/admin/homepage-builder/block-editors/CustomContentBlockEditor.tsx
 *
 * Inspector editor for the `customContentPlaceholder` section type.
 *
 * This block is currently registered as `coming-next` status and has an
 * intentionally empty config. This editor shows an informational placeholder
 * rather than an empty form, guiding editors toward what will be available
 * in future slices.
 *
 * Does NOT modify serialization or storage behaviour.
 */

import { Blocks, Info, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// CustomContentBlockEditor
// ---------------------------------------------------------------------------

// Props are required by the BlockEditorProps interface but intentionally unused
// (this block is a future-content placeholder with no editable config yet).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CustomContentBlockEditor(_props: Props) {
  return (
    <div className="px-4 py-5 space-y-4">
      {/* Block icon + title */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <Blocks className="h-4 w-4 text-[var(--muted)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Freier Inhalt
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">
            Block-Typ: customContentPlaceholder
          </p>
        </div>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-700">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Dieser Block ist als Grundlage für zukünftige Premium-Inhaltsbereiche
          reserviert. Bearbeitungsfelder werden in einem kommenden Slice
          freigeschaltet.
        </span>
      </div>

      {/* Coming soon indicator */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--text-2)]">
        <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="font-medium">Coming soon:</span>
        <span>Rich-Text, Medien, und Block-basierte Inhaltserstellung</span>
      </div>
    </div>
  );
}
