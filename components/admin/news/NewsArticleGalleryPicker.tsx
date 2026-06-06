"use client";

/**
 * NewsArticleGalleryPicker — Article gallery management (News CMS V2.1).
 *
 * Displays the current gallery as a grid, allows adding via MediaLibraryModal,
 * editing captions inline, and removing items. Works in both create and edit mode.
 *
 * In create mode (no articleId), gallery changes are kept in local state and
 * submitted as part of form save via the onGalleryChange callback.
 *
 * In edit mode (articleId provided), gallery items are persisted immediately
 * via /api/news/[id]/gallery (add) and /api/news/[id]/gallery/[itemId] (delete).
 */

import { useState } from "react";
import { Film, ImageIcon, Loader2, Plus, X } from "lucide-react";
import MediaLibraryModal from "@/components/admin/media/MediaLibraryModal";
import type { MediaPickerValue } from "@/components/admin/media/MediaLibraryModal";
import type { NewsArticleGalleryItem } from "@/lib/news/admin-queries";

// ── Types ─────────────────────────────────────────────────────────────────────

type LocalGalleryItem = {
  id: string;
  mediaAssetId: string;
  caption: string | null;
  orderIndex: number;
  mediaAsset: {
    id: string;
    url: string;
    altText: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    type: string;
  };
};

type NewsArticleGalleryPickerProps = {
  /** Article ID for server-persisted mode; omit for local-only create mode */
  articleId?: string;
  /** Initial gallery items (from server) */
  initialItems?: NewsArticleGalleryItem[];
  /** Called when gallery changes in local (create) mode */
  onGalleryChange?: (items: LocalGalleryItem[]) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewsArticleGalleryPicker({
  articleId,
  initialItems = [],
  onGalleryChange,
}: NewsArticleGalleryPickerProps) {
  const [items, setItems] = useState<LocalGalleryItem[]>(
    initialItems as LocalGalleryItem[],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [addingError, setAddingError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const existingIds = new Set(items.map((i) => i.mediaAssetId));

  async function handleSelectAsset(asset: MediaPickerValue) {
    setAddingError(null);
    // Skip if already in gallery
    if (existingIds.has(asset.id)) {
      setModalOpen(false);
      return;
    }

    const nextOrder = items.length;

    if (articleId) {
      // Server-persisted mode: POST to gallery endpoint
      try {
        const res = await fetch(`/api/news/${articleId}/gallery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaAssetId: asset.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddingError(data?.error ?? "Fehler beim Hinzufügen.");
          return;
        }
        const newItem = data.item as LocalGalleryItem;
        setItems((prev) => [...prev, newItem]);
      } catch {
        setAddingError("Netzwerkfehler. Bitte erneut versuchen.");
        return;
      }
    } else {
      // Local mode: add to state
      const newItem: LocalGalleryItem = {
        id: `local-${Date.now()}`,
        mediaAssetId: asset.id,
        caption: null,
        orderIndex: nextOrder,
        mediaAsset: {
          id: asset.id,
          url: asset.url,
          altText: asset.altText,
          filename: asset.filename,
          mimeType: "",
          sizeBytes: 0,
          width: null,
          height: null,
          type: "IMAGE",
        },
      };
      const updated = [...items, newItem];
      setItems(updated);
      onGalleryChange?.(updated);
    }
    setModalOpen(false);
  }

  async function handleRemove(item: LocalGalleryItem) {
    setRemoving(item.id);
    setAddingError(null);
    try {
      if (articleId && !item.id.startsWith("local-")) {
        const res = await fetch(`/api/news/${articleId}/gallery/${item.id}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) {
          setAddingError("Fehler beim Entfernen.");
          return;
        }
      }
      const updated = items.filter((i) => i.id !== item.id);
      setItems(updated);
      onGalleryChange?.(updated);
    } catch {
      setAddingError("Netzwerkfehler.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Error */}
      {addingError && (
        <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {addingError}
        </div>
      )}

      {/* Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <GalleryItemCard
              key={item.id}
              item={item}
              removing={removing === item.id}
              onRemove={() => handleRemove(item)}
            />
          ))}
          {/* Add button as grid cell */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)]"
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs font-medium">Hinzufügen</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)]"
        >
          <ImageIcon className="h-7 w-7 opacity-35" />
          <p className="text-xs font-medium">Galerie-Bilder hinzufügen</p>
        </button>
      )}

      {/* Add button when gallery is non-empty */}
      {items.length > 0 && (
        <p className="text-[11px] text-[var(--muted)]">{items.length} Bild{items.length !== 1 ? "er" : ""} in der Galerie</p>
      )}

      <MediaLibraryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelectAsset}
        title="Galerie-Bild wählen"
      />
    </div>
  );
}

// ── GalleryItemCard ───────────────────────────────────────────────────────────

function GalleryItemCard({
  item,
  removing,
  onRemove,
}: {
  item: LocalGalleryItem;
  removing: boolean;
  onRemove: () => void;
}) {

  function handleRemoveClick(e: React.MouseEvent) {
    e.stopPropagation();
    onRemove();
  }

  return (
    <div className="group relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-2)]">
        {item.mediaAsset.type === "IMAGE" ? (
          <img
            src={item.mediaAsset.url}
            alt={item.mediaAsset.altText ?? item.mediaAsset.filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--muted)]">
            <Film className="h-8 w-8 opacity-40" />
            <span className="text-[10px] uppercase font-semibold">Video</span>
          </div>
        )}

        {/* Remove button — visible on hover */}
        <button
          type="button"
          onClick={handleRemoveClick}
          disabled={removing}
          className="absolute right-1.5 top-1.5 flex items-center justify-center rounded-full bg-rose-600 p-1 text-white opacity-0 transition group-hover:opacity-100"
          title="Aus Galerie entfernen"
        >
          {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="p-2">
        <p className="truncate text-[11px] font-medium text-[var(--foreground)]" title={item.mediaAsset.filename}>
          {item.mediaAsset.filename}
        </p>
        {item.caption && (
          <p className="mt-0.5 truncate text-[10px] italic text-[var(--muted)]">{item.caption}</p>
        )}
        {item.mediaAsset.sizeBytes > 0 && (
          <p className="text-[10px] text-[var(--muted)]">{formatBytes(item.mediaAsset.sizeBytes)}</p>
        )}
      </div>
    </div>
  );
}
