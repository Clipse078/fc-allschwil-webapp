"use client";

/**
 * components/admin/visual-builder/SmartImagesRegion.tsx
 *
 * CMS V3 — Smart Images Region for the Visual Canvas.
 *
 * Renders the configured images with direct manipulation controls:
 *   - "+ Bild hinzufügen" opens SharedMediaPicker (DAM)
 *   - "Bild ändern" replaces an image via SharedMediaPicker
 *   - "Bild entfernen" removes an image ref
 *   - Images are always stored as mediaAssetId references (no raw URLs)
 *
 * For each configured image, a thumbnail is shown if a preview URL
 * is available from the DAM API; otherwise the mediaAssetId is
 * displayed as a monospace reference.
 */

import { useState } from "react";
import { Plus, Trash2, RefreshCw, Image as ImageIcon } from "lucide-react";
import SharedMediaPicker from "@/components/admin/media/SharedMediaPicker";
import type { SplitContentImageRef } from "@/lib/homepage/section-types";
import type { MediaAssetListItem } from "@/lib/media/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SmartImagesRegionProps = {
  images: SplitContentImageRef[];
  onImagesChange: (images: SplitContentImageRef[]) => void;
};

// ---------------------------------------------------------------------------
// SmartImagesRegion
// ---------------------------------------------------------------------------

export default function SmartImagesRegion({
  images,
  onImagesChange,
}: SmartImagesRegionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Index of image slot being replaced; null means adding new */
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  function handleSelectAsset(asset: MediaAssetListItem) {
    const ref: SplitContentImageRef = {
      mediaAssetId: asset.id,
      alt: asset.altText ?? "",
      caption: "",
    };

    if (replacingIndex !== null) {
      const next = [...images];
      next[replacingIndex] = ref;
      onImagesChange(next);
    } else {
      onImagesChange([...images, ref]);
    }

    setPickerOpen(false);
    setReplacingIndex(null);
  }

  function removeImage(index: number) {
    onImagesChange(images.filter((_, i) => i !== index));
  }

  function openPicker(replaceIndex: number | null = null) {
    setReplacingIndex(replaceIndex);
    setPickerOpen(true);
  }

  return (
    <div className="space-y-2">
      {/* Existing images */}
      {images.map((img, idx) => (
        <div
          key={idx}
          className="group/img flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5"
        >
          {/* Thumbnail placeholder */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100">
            <ImageIcon className="h-5 w-5 text-gray-400" />
          </div>

          {/* Asset ref */}
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[10px] text-[var(--muted)]">
              {img.mediaAssetId}
            </p>
            {img.alt && (
              <p className="truncate text-[11px] text-[var(--text-2)]">
                {img.alt}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => openPicker(idx)}
              className="rounded p-1 text-[var(--muted)] transition hover:text-[var(--foreground)]"
              title="Bild ändern"
              aria-label="Bild ändern"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="rounded p-1 text-rose-500 transition hover:text-rose-700"
              title="Bild entfernen"
              aria-label="Bild entfernen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      {/* Add image button */}
      <button
        type="button"
        onClick={() => openPicker(null)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-sm font-medium text-blue-600 transition hover:border-blue-400 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        aria-label="Bild hinzufügen"
      >
        <Plus className="h-4 w-4" />
        Bild hinzufügen
      </button>

      {/* DAM picker dialog */}
      <SharedMediaPicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setReplacingIndex(null);
        }}
        onSelect={handleSelectAsset}
        filterType="IMAGE"
        title={
          replacingIndex !== null
            ? "Bild ersetzen — aus Mediathek auswählen"
            : "Bild hinzufügen — aus Mediathek auswählen"
        }
      />
    </div>
  );
}
