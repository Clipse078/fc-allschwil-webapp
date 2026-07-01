"use client";

import { RefreshCw, ClipboardCheck, Eye } from "lucide-react";
import Link from "next/link";
import { CMS_ROUTES } from "@/lib/cms/routes";

type Props = {
  sectionCount: number;
  publishedCount: number;
  loading: boolean;
  disabled: boolean;
  onRefresh: () => void;
  onPreview: () => void;
};

export function HomepageBuilderToolbar({
  sectionCount,
  publishedCount,
  loading,
  disabled,
  onRefresh,
  onPreview,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
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
                  {" "}· <span className="text-[var(--foreground)]">{publishedCount}</span> veröffentlicht
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={CMS_ROUTES.review}
          className="fca-button-secondary px-2.5"
          title="Review-Queue öffnen"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-1 text-xs">Review-Queue</span>
        </Link>

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
