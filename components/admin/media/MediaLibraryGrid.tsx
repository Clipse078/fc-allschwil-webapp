"use client";

import { useEffect, useState, useCallback } from "react";
import { ImageIcon, Film, RefreshCw } from "lucide-react";
import MediaAssetCard from "@/components/admin/media/MediaAssetCard";
import MediaUploadButton from "@/components/admin/media/MediaUploadButton";
import type { MediaAssetListItem } from "@/lib/media/types";

type FilterType = "ALL" | "IMAGE" | "VIDEO";

type MediaLibraryGridProps = {
  onSelect?: (asset: MediaAssetListItem) => void;
  selectable?: boolean;
};

export default function MediaLibraryGrid({
  onSelect,
  selectable = false,
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

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              <span className="ml-0.5 text-[10px] text-[var(--muted)]">
                {f === "ALL" ? total : ""}
              </span>
            </button>
          ))}
        </div>

        {/* Actions */}
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
          <MediaUploadButton onUploaded={handleUploaded} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading && assets.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[var(--muted)]">
          <ImageIcon className="h-10 w-10 opacity-30" />
          <p className="text-sm">Noch keine Medien vorhanden.</p>
          <MediaUploadButton onUploaded={handleUploaded} label="Erste Datei hochladen" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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

      {/* Count */}
      {!loading && assets.length > 0 && (
        <p className="text-[11px] text-[var(--muted)]">
          {assets.length} von {total} Medien geladen
        </p>
      )}
    </div>
  );
}
