"use client";

/**
 * WebsitePreviewModeSwitch
 *
 * Draft / Published preview mode selector for the Website Preview Shell.
 *
 * - Draft mode: renders all sections including unpublished / disabled ones
 *   (with visual dimming and status labels).
 * - Published mode: renders only sections that are active and published
 *   (mirrors what the public website shows).
 *
 * Pure UI — no data fetching.
 */

import { FileEdit, Globe } from "lucide-react";

export type PreviewMode = "draft" | "published";

type Props = {
  mode: PreviewMode;
  onChange: (mode: PreviewMode) => void;
};

export default function WebsitePreviewModeSwitch({ mode, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
      <button
        type="button"
        onClick={() => onChange("draft")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
          mode === "draft"
            ? "bg-white text-amber-700 shadow-sm"
            : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
        title="Draft Preview — zeigt alle Sektionen inkl. unveröffentlichte"
      >
        <FileEdit className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Draft</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("published")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
          mode === "published"
            ? "bg-white text-emerald-700 shadow-sm"
            : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
        title="Published Preview — zeigt nur aktive und veröffentlichte Sektionen"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Published</span>
      </button>
    </div>
  );
}
