"use client";

/**
 * components/admin/homepage-builder/media/HomepageMediaField.tsx
 *
 * Premium media selection field for Homepage Builder block editors.
 *
 * Reuses SharedMediaPicker (the canonical DAM picker) and provides a
 * polished empty state, thumbnail preview, asset metadata, and
 * replace / remove actions.
 *
 * The component manages a local preview snapshot (url, filename, dimensions,
 * mimeType) in component state so the inspector shows a rich preview after
 * selection. The persisted value is `assetId` only — callers write that to
 * their config key; the preview snapshot is ephemeral and session-local.
 *
 * Slice H.5: On mount (or when assetId changes), if no local snapshot exists,
 * the component fetches GET /api/media/[id] to resolve the preview URL so
 * background images show correctly after a page reload. If the fetch fails,
 * the existing graceful placeholder is kept.
 *
 * Public API:
 *   assetId    — the currently persisted DAM asset ID (or null)
 *   onSelect   — called with the full MediaAssetListItem on selection
 *   onRemove   — called with no args when the editor removes the asset
 *   filterType — optional picker type filter ("IMAGE" | "VIDEO")
 *   pickerTitle — optional dialog title override
 */

import { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Film,
  RotateCcw,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import SharedMediaPicker from "@/components/admin/media/SharedMediaPicker";
import type { MediaAssetListItem } from "@/lib/media/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Ephemeral preview snapshot cached in local component state. */
type AssetSnapshot = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  type: "IMAGE" | "VIDEO";
};

export type HomepageMediaFieldProps = {
  /** Persisted DAM asset ID, or null when no asset is selected. */
  assetId: string | null | undefined;
  /** Fires with the full asset when the user confirms a selection. */
  onSelect: (asset: MediaAssetListItem) => void;
  /** Fires when the user removes the current asset. */
  onRemove: () => void;
  /** Restrict picker to images or videos. Default: images only. */
  filterType?: "IMAGE" | "VIDEO";
  /** Override the picker dialog title. */
  pickerTitle?: string;
  /** Placeholder label shown in the empty state. */
  emptyLabel?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDimensions(w: number | null, h: number | null): string {
  if (!w || !h) return "";
  return `${w} × ${h}`;
}

function mimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "video/mp4": "MP4",
    "video/webm": "WebM",
  };
  return map[mimeType] ?? mimeType.split("/")[1]?.toUpperCase() ?? "–";
}

// ---------------------------------------------------------------------------
// HomepageMediaField
// ---------------------------------------------------------------------------

export function HomepageMediaField({
  assetId,
  onSelect,
  onRemove,
  filterType = "IMAGE",
  pickerTitle = "Medium auswählen",
  emptyLabel = "Kein Bild ausgewählt",
}: HomepageMediaFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<AssetSnapshot | null>(null);

  // Slice H.5 — Resolve assetId → preview URL after page reload.
  // When assetId is set but we have no local snapshot (or the snapshot
  // belongs to a different asset), fetch the media record from the API.
  // This keeps the inspector's thumbnail in sync after a full page reload.
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setPreviewError(false);
      return;
    }
    // Already have the right snapshot from this session
    if (snapshot !== null && snapshot.id === assetId) return;

    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError(false);

    fetch(`/api/media/${assetId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then((data: { asset?: MediaAssetListItem }) => {
        if (cancelled) return;
        const a = data?.asset;
        if (a) {
          setSnapshot({
            id: a.id,
            url: a.url,
            filename: a.filename,
            mimeType: a.mimeType,
            width: a.width ?? null,
            height: a.height ?? null,
            type: a.type,
          });
        } else {
          setPreviewError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  function handleSelect(asset: MediaAssetListItem) {
    setSnapshot({
      id: asset.id,
      url: asset.url,
      filename: asset.filename,
      mimeType: asset.mimeType,
      width: asset.width ?? null,
      height: asset.height ?? null,
      type: asset.type,
    });
    setPreviewError(false);
    onSelect(asset);
    setPickerOpen(false);
  }

  function handleRemove() {
    setSnapshot(null);
    setPreviewError(false);
    onRemove();
  }

  const hasAsset = Boolean(assetId);
  const hasPreview = snapshot !== null && snapshot.id === assetId;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasAsset) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 text-center transition hover:border-[var(--tenant-primary)] hover:bg-[var(--surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary)]"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
              <ImageIcon className="h-4.5 w-4.5 text-[var(--muted)]" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-2)]">
                {emptyLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--tenant-primary)] font-medium">
                Aus Mediathek auswählen
              </p>
            </div>
          </div>
        </button>

        <SharedMediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleSelect}
          filterType={filterType}
          title={pickerTitle}
        />
      </>
    );
  }

  // ── Loading preview (fetching asset URL after reload) ──────────────────────
  if (loadingPreview) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shrink-0">
            <Loader2 className="h-3.5 w-3.5 text-[var(--tenant-primary)] animate-spin" />
          </div>
          <p className="text-xs text-[var(--muted)]">Vorschau wird geladen…</p>
        </div>
      </div>
    );
  }

  // ── Selected with preview ──────────────────────────────────────────────────
  if (hasPreview) {
    const dims = formatDimensions(snapshot.width, snapshot.height);
    return (
      <>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {/* Thumbnail */}
          <div className="relative aspect-video w-full bg-[var(--surface-2)]">
            {snapshot.type === "IMAGE" ? (
              <img
                src={snapshot.url}
                alt={snapshot.filename}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Film className="h-8 w-8 text-[var(--muted)]" />
              </div>
            )}
          </div>

          {/* Metadata row */}
          <div className="px-3 py-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--foreground)]">
                {snapshot.filename}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {dims && (
                  <span className="text-[10px] text-[var(--muted)]">{dims}</span>
                )}
                <span className="text-[10px] font-medium text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5 leading-none">
                  {mimeLabel(snapshot.mimeType)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                title="Bild ersetzen"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemove}
                title="Bild entfernen"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <SharedMediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleSelect}
          filterType={filterType}
          title={pickerTitle}
        />
      </>
    );
  }

  // ── Asset ID set but preview could not be resolved ─────────────────────────
  // This covers both: resolution failed, and initial render before fetch
  // completes. Shows a graceful admin-only placeholder.
  return (
    <>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${
              previewError
                ? "bg-amber-50 border-amber-200"
                : "bg-[var(--surface-2)] border-[var(--border)]"
            }`}
          >
            {previewError ? (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 text-[var(--tenant-primary)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--foreground)]">
              {previewError ? "Vorschau nicht verfügbar" : "Bild gesetzt"}
            </p>
            {previewError && (
              <p className="mt-0.5 text-[10px] text-amber-600">
                Asset-Vorschau konnte nicht geladen werden
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              title="Bild ersetzen"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              title="Bild entfernen"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <SharedMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        filterType={filterType}
        title={pickerTitle}
      />
    </>
  );
}
