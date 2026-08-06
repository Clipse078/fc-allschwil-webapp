"use client";

/**
 * NewsArticleMediaGallery — "Weitere Medien" (additional media) editor.
 *
 * Uses the exact same media selection experience as the Hero Image picker
 * (MediaPickerDialog → SharedMediaPicker), opened in multi-selection mode.
 * Newly selected assets are appended to the article's additional media.
 */

import { useState } from "react";
import { ChevronUp, ChevronDown, X, ImageIcon, Film } from "lucide-react";
import MediaPickerDialog from "@/components/admin/media/MediaPickerDialog";
import MediaUploadButton from "@/components/admin/media/MediaUploadButton";
import type { MediaAssetListItem } from "@/lib/media/types";
import type { NewsArticleMediaItem } from "@/lib/news/admin-queries";

type NewsArticleMediaGalleryProps = {
  /** Article ID — undefined in create mode (media cannot be added until article is saved). */
  articleId?: string;
  /** Current additional media items (loaded from the server). */
  items: NewsArticleMediaItem[];
  /** Called after items change (add / remove / reorder) to refresh parent state. */
  onItemsChange: (items: NewsArticleMediaItem[]) => void;
};

export default function NewsArticleMediaGallery({
  articleId,
  items,
  onItemsChange,
}: NewsArticleMediaGalleryProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(asset: MediaAssetListItem) {
    if (!articleId) return;
    setError(null);
    setActionPending(`add-${asset.id}`);
    try {
      const res = await fetch(`/api/news/${articleId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaAssetId: asset.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Hinzufügen.");
        return;
      }
      // Append new item
      onItemsChange([...items, data.item]);
    } finally {
      setActionPending(null);
    }
  }

  /**
   * Adds every newly picked asset (skipping ones already attached) to the
   * article. Each asset still goes through the existing single-add API
   * (unchanged), but results are batched into a single onItemsChange call
   * so multi-select from the picker doesn't clobber itself across awaits.
   */
  async function handleAddMultiple(assets: MediaAssetListItem[]) {
    if (!articleId) return;
    const newAssets = assets.filter((a) => !existingIds.includes(a.id));
    if (newAssets.length === 0) {
      setPickerOpen(false);
      return;
    }

    setError(null);
    setActionPending("add-multiple");
    try {
      const addedItems: NewsArticleMediaItem[] = [];
      for (const asset of newAssets) {
        const res = await fetch(`/api/news/${articleId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaAssetId: asset.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? "Fehler beim Hinzufügen.");
          continue;
        }
        addedItems.push(data.item);
      }
      if (addedItems.length > 0) {
        onItemsChange([...items, ...addedItems]);
      }
    } finally {
      setActionPending(null);
      setPickerOpen(false);
    }
  }

  async function handleRemove(mediaAssetId: string) {
    if (!articleId) return;
    setError(null);
    setActionPending(`remove-${mediaAssetId}`);
    try {
      const res = await fetch(
        `/api/news/${articleId}/media?assetId=${encodeURIComponent(mediaAssetId)}`,
        { method: "DELETE" },
      );
      if (res.ok || res.status === 204) {
        onItemsChange(items.filter((i) => i.mediaAssetId !== mediaAssetId));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Entfernen.");
      }
    } finally {
      setActionPending(null);
    }
  }

  async function handleMove(mediaAssetId: string, direction: "up" | "down") {
    if (!articleId) return;
    const idx = items.findIndex((i) => i.mediaAssetId === mediaAssetId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;

    const reordered = [...items];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const orderedIds = reordered.map((i) => i.mediaAssetId);

    setError(null);
    setActionPending(`move-${mediaAssetId}`);
    try {
      const res = await fetch(`/api/news/${articleId}/media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Sortieren.");
        return;
      }
      onItemsChange(data.media ?? reordered);
    } finally {
      setActionPending(null);
    }
  }

  const existingIds = items.map((i) => i.mediaAssetId);

  if (!articleId) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-6 text-center text-[var(--muted)]">
        <ImageIcon className="h-5 w-5 opacity-40" />
        <p className="text-xs">Artikel zuerst speichern, um weitere Medien hinzuzufügen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Gallery grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {items.map((item, idx) => {
            const isImage = item.mediaAsset.type === "IMAGE";
            const isPending = actionPending?.includes(item.mediaAssetId);
            return (
              <div
                key={item.id}
                className={`relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] ${isPending ? "opacity-50" : ""}`}
              >
                {isImage ? (
                  <img
                    src={item.mediaAsset.url}
                    alt={item.mediaAsset.altText ?? item.mediaAsset.filename}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-slate-100">
                    <Film className="h-6 w-6 text-slate-400" />
                  </div>
                )}

                {/* Caption */}
                {item.caption && (
                  <p className="truncate px-2 py-1 text-[10px] text-[var(--muted)]">
                    {item.caption}
                  </p>
                )}

                {/* Controls overlay */}
                <div className="absolute right-1 top-1 flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={isPending || idx === 0}
                    onClick={() => handleMove(item.mediaAssetId, "up")}
                    className="rounded bg-black/50 p-0.5 text-white transition hover:bg-black/70 disabled:opacity-30"
                    title="Nach oben"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending || idx === items.length - 1}
                    onClick={() => handleMove(item.mediaAssetId, "down")}
                    className="rounded bg-black/50 p-0.5 text-white transition hover:bg-black/70 disabled:opacity-30"
                    title="Nach unten"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemove(item.mediaAssetId)}
                    className="rounded bg-rose-500/80 p-0.5 text-white transition hover:bg-rose-600 disabled:opacity-30"
                    title="Entfernen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-5 text-center text-[var(--muted)]">
          <ImageIcon className="h-5 w-5 opacity-40" />
          <p className="text-xs">Noch keine weiteren Medien hinzugefügt.</p>
        </div>
      )}

      {error && (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="fca-button-secondary text-xs"
        >
          Aus Mediathek auswählen
        </button>
        <MediaUploadButton
          onUploaded={handleAdd}
          label="Neues Medium hochladen"
          className="fca-button-secondary text-xs"
        />
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectionMode="multiple"
        onSelect={handleAddMultiple}
        title="Weitere Medien auswählen"
      />
    </div>
  );
}
