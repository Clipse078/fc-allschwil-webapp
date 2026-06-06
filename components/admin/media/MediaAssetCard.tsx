"use client";

import { useState } from "react";
import { Film, ImageIcon, Trash2 } from "lucide-react";
import type { MediaAssetListItem } from "@/lib/media/types";

type MediaAssetCardProps = {
  asset: MediaAssetListItem;
  onSelect?: (asset: MediaAssetListItem) => void;
  onDelete?: (id: string) => void;
  selectable?: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaAssetCard({
  asset,
  onSelect,
  onDelete,
  selectable = false,
}: MediaAssetCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete?.(asset.id);
  }

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] transition ${
        selectable ? "cursor-pointer hover:border-[var(--tenant-primary)] hover:shadow-sm" : ""
      }`}
      onClick={selectable ? () => onSelect?.(asset) : undefined}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
        {asset.type === "IMAGE" ? (
          <img
            src={asset.url}
            alt={asset.altText ?? asset.filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-[var(--muted)]">
            <Film className="h-8 w-8" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Video</span>
          </div>
        )}

        {/* Type badge */}
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
          {asset.type === "IMAGE" ? (
            <ImageIcon className="h-2.5 w-2.5" />
          ) : (
            <Film className="h-2.5 w-2.5" />
          )}
          {asset.type === "IMAGE" ? "Bild" : "Video"}
        </span>

        {/* Delete button */}
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className={`absolute right-1.5 top-1.5 rounded-full p-1 text-white transition ${
              confirmDelete
                ? "bg-rose-600"
                : "bg-black/40 opacity-0 group-hover:opacity-100"
            }`}
            title={confirmDelete ? "Wirklich löschen?" : "Archivieren"}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-0.5 p-2">
        <p
          className="truncate text-[11px] font-medium text-[var(--foreground)]"
          title={asset.filename}
        >
          {asset.filename}
        </p>
        <p className="text-[10px] text-[var(--muted)]">
          {formatBytes(asset.sizeBytes)}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
        </p>
        {asset.altText && (
          <p className="truncate text-[10px] italic text-[var(--muted)]">{asset.altText}</p>
        )}
      </div>
    </div>
  );
}
