"use client";

import { useEffect, useState, useCallback } from "react";
import { ImageIcon, Film, RefreshCw } from "lucide-react";
import MediaAssetCard from "@/components/admin/media/MediaAssetCard";
import MediaUploadButton from "@/components/admin/media/MediaUploadButton";
import type { MediaAssetListItem } from "@/lib/media/types";
import { SectionCard, EmptyState } from "@/components/ui/page";

type FilterType = "ALL" | "IMAGE" | "VIDEO";

type MediaLibraryGridProps = {
  onSelect?: (asset: MediaAssetListItem) => void;
  selectable?: boolean;
  /**
   * Increment this key from a parent component to trigger a grid re-fetch.
   * Used by the page-level upload button to synchronise with the grid after
   * an upload completes. Existing picker usages that don't pass this prop
   * are unaffected.
   */
  refreshKey?: number;
};

export default function MediaLibraryGrid({
  onSelect,
  selectable = false,
  refreshKey = 0,
}: MediaLibraryGridProps) {
  const [assets, setAssets] = useState<MediaAssetListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filter !== "ALL") params.set("type", filter);
      const res = await fetch(`/api/media?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler beim Laden");
      setAssets(data.assets ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Re-fetch when filter changes or parent signals a new upload via refreshKey.
  useEffect(() => {
    loadAssets();
  }, [loadAssets, refreshKey]);

  function handleUploaded(asset: MediaAssetListItem) {
    setAssets((prev) => [asset, ...prev]);
    setTotal((t) => t + 1);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    }
  }

  return (
    <SectionCard noPadding>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
        {/* Filter tabs */}
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-medium">
          {(["ALL", "IMAGE", "VIDEO"] as FilterType[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition ${
                filter === f
                  ? "bg-[var(--surface)] shadow-sm text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {f === "IMAGE" && <ImageIcon className="h-3 w-3" />}
              {f === "VIDEO" && <Film className="h-3 w-3" />}
              {f === "ALL" ? "Alle" : f === "IMAGE" ? "Bilder" : "Videos"}
              {f === "ALL" && total > 0 && (
                <span className="ml-0.5 text-[10px] text-[var(--muted)]">{total}</span>
              )}
            </button>
          ))}
        </div>

        {/* Refresh + inline upload (for picker contexts and secondary action) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAssets}
            disabled={loading}
            className="fca-button-secondary px-2.5"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {/* Show upload button in toolbar when used as a standalone picker (no page-level PageActions) */}
          {!onSelect && (
            <MediaUploadButton onUploaded={handleUploaded} />
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Content: skeleton → empty → grid */}
      {loading && assets.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-10 w-10" />}
          heading="Noch keine Medien vorhanden"
          description="Lade Bilder oder Videos hoch, um sie in Artikeln und Seiten zu verwenden."
          action={
            !onSelect ? (
              <MediaUploadButton
                onUploaded={handleUploaded}
                label="Erste Datei hochladen"
                className="fca-button-primary"
              />
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((asset) => (
            <MediaAssetCard
              key={asset.id}
              asset={asset}
              onSelect={onSelect}
              onDelete={handleDelete}
              selectable={selectable}
            />
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loading && assets.length > 0 && (
        <div className="border-t border-[var(--border)] px-5 py-3">
          <p className="text-[11px] text-[var(--muted)]">
            {assets.length} von {total} Medien geladen
          </p>
        </div>
      )}
    </SectionCard>
  );
}
