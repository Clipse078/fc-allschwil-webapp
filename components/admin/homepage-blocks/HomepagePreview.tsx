"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import HeroBlockRenderer from "@/components/admin/homepage-blocks/HeroBlockRenderer";
import type { HomepageBlockAdminItem } from "@/lib/homepage-blocks/admin-queries";

type HomepagePreviewProps = {
  tenantPrimaryColor?: string;
  tenantSecondaryColor?: string;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "In Prüfung",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
};

export default function HomepagePreview({
  tenantPrimaryColor = "#0b4aa2",
  tenantSecondaryColor = "#c7332c",
}: HomepagePreviewProps) {
  const [blocks, setBlocks] = useState<HomepageBlockAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage-blocks/preview");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setBlocks(data.blocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unpublishedCount = blocks.filter((b) => b.status !== "PUBLISHED").length;

  return (
    <div className="space-y-6">
      {/* Preview header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-[var(--muted)]">
            Vorschau aller aktiven Blöcke — inkl. Entwürfe und unveröffentlichte Inhalte.
            Diese Ansicht ist nur für authentifizierte Nutzer mit WEBSITE_MANAGE-Berechtigung sichtbar.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="fca-button-secondary text-xs inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </button>
      </div>

      {/* Unpublished warning */}
      {!loading && unpublishedCount > 0 && (
        <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {unpublishedCount === 1
                ? "1 unveröffentlichter Block"
                : `${unpublishedCount} unveröffentlichte Blöcke`}{" "}
              in dieser Vorschau
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Blöcke mit dem Status «Entwurf», «In Prüfung» oder «Geplant» werden in der
              öffentlichen API nicht angezeigt — nur in dieser geschützten Vorschau.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      )}

      {/* Block renderers */}
      {!loading && blocks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-24 text-[var(--muted)]">
          <p className="text-sm">Keine Blöcke vorhanden oder alle archiviert.</p>
          <a href="/dashboard/website/homepage" className="fca-button-primary text-sm">
            Blöcke verwalten
          </a>
        </div>
      )}

      {!loading && blocks.length > 0 && (
        <div className="space-y-2">
          {blocks.map((block) => (
            <div key={block.id} className="space-y-1">
              {/* Block metadata strip */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    {block.title}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      block.status === "PUBLISHED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : block.status === "IN_REVIEW"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : block.status === "SCHEDULED"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                    }`}
                  >
                    {STATUS_LABEL[block.status] ?? block.status}
                  </span>
                </div>
                <a
                  href={`/dashboard/website/homepage/${block.id}/edit`}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] transition"
                >
                  Bearbeiten →
                </a>
              </div>

              {/* Rendered block */}
              <HeroBlockRenderer
                block={block}
                tenantPrimaryColor={tenantPrimaryColor}
                tenantSecondaryColor={tenantSecondaryColor}
                showStatusBadge
              />
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {!loading && blocks.length > 0 && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Vorschau-Legende
          </p>
          <div className="flex flex-wrap gap-4 text-[10px] text-[var(--muted)]">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Veröffentlicht — in der öffentlichen API sichtbar
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Entwurf / Geplant / In Prüfung — nur in dieser Vorschau sichtbar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
