"use client";

import { RefreshCw, ClipboardCheck, Eye, List, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { CMS_ROUTES } from "@/lib/cms/routes";

export type BuilderMode = "list" | "canvas";

type Props = {
  sectionCount: number;
  publishedCount: number;
  loading: boolean;
  disabled: boolean;
  builderMode: BuilderMode;
  onBuilderModeChange: (mode: BuilderMode) => void;
  onRefresh: () => void;
  onPreview: () => void;
};

const MODE_CONFIG: { mode: BuilderMode; label: string; icon: React.ElementType; title: string }[] = [
  { mode: "list",   label: "Liste",  icon: List,        title: "Listen-Modus" },
  { mode: "canvas", label: "Canvas", icon: LayoutGrid,  title: "Canvas-Modus" },
];

export function HomepageBuilderToolbar({
  sectionCount,
  publishedCount,
  loading,
  disabled,
  builderMode,
  onBuilderModeChange,
  onRefresh,
  onPreview,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
      {/* Left: section count */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-medium text-[var(--foreground)]">
          {loading ? (
            <span className="text-[var(--muted)]">Wird geladen…</span>
          ) : (
            <>
              <span className="text-[var(--foreground)]">{sectionCount}</span>
              <span className="text-[var(--muted)]">
                {" "}Sektion{sectionCount !== 1 ? "en" : ""}
              </span>
              {sectionCount > 0 && (
                <span className="text-[var(--muted)]">
                  {" "}·{" "}
                  <span className="text-[var(--foreground)]">{publishedCount}</span>{" "}
                  veröffentlicht
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Right: mode toggle + actions */}
      <div className="flex items-center gap-2">
        {/* Mode toggle pill */}
        <div
          className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
          role="group"
          aria-label="Ansichtsmodus"
        >
          {MODE_CONFIG.map(({ mode, label, icon: Icon, title }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onBuilderModeChange(mode)}
              disabled={disabled}
              title={title}
              aria-pressed={builderMode === mode}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] ${
                builderMode === mode
                  ? "bg-white text-[var(--foreground)] shadow-sm font-medium"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Review queue */}
        <Link
          href={CMS_ROUTES.review}
          className="fca-button-secondary px-2.5"
          title="Review-Queue öffnen"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-1 text-xs">Review-Queue</span>
        </Link>

        {/* Preview */}
        <button
          type="button"
          onClick={onPreview}
          disabled={disabled || sectionCount === 0}
          className="fca-button-secondary px-2.5"
          title="Vorschau anzeigen"
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-1 text-xs">Vorschau</span>
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || disabled}
          className="fca-button-secondary px-2.5"
          title="Aktualisieren"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
