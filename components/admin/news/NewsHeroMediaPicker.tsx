"use client";

/**
 * NewsHeroMediaPicker — Hero Image selector for News articles.
 *
 * Uses the exact same media selection experience as "Weitere Medien"
 * (MediaPickerDialog → SharedMediaPicker) in single-selection mode. The
 * only difference between the two entry points is the selection mode;
 * search, filters, upload, pagination, previews and keyboard shortcuts are
 * shared, unmodified code.
 *
 * Selecting an asset from the library immediately assigns it as the hero
 * image — no separate "confirm" step.
 */

import { useState } from "react";
import { ImageIcon, RotateCcw } from "lucide-react";
import MediaPickerDialog from "@/components/admin/media/MediaPickerDialog";
import MediaUploadButton from "@/components/admin/media/MediaUploadButton";
import type { MediaAssetListItem } from "@/lib/media/types";

type NewsHeroMediaPickerProps = {
  value: { id: string; url: string; altText: string | null; filename: string } | null;
  onChange: (asset: { id: string; url: string; altText: string | null; filename: string } | null) => void;
};

export default function NewsHeroMediaPicker({ value, onChange }: NewsHeroMediaPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleSelect(assets: MediaAssetListItem[]) {
    const asset = assets[0];
    if (!asset) return;
    onChange({ id: asset.id, url: asset.url, altText: asset.altText, filename: asset.filename });
    setPickerOpen(false);
  }

  function handleUploaded(asset: MediaAssetListItem) {
    onChange({ id: asset.id, url: asset.url, altText: asset.altText, filename: asset.filename });
  }

  return (
    <div className="space-y-3">
      {/* Current selection */}
      {value ? (
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]">
          <img
            src={value.url}
            alt={value.altText ?? value.filename}
            className="h-48 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2">
            <p className="truncate text-[11px] text-white">{value.filename}</p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="ml-2 rounded-full bg-white/20 p-1 text-white transition hover:bg-white/40"
              title="Headerbild ersetzen"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]">
          <div className="flex flex-col items-center gap-1">
            <ImageIcon className="h-6 w-6 opacity-40" />
            <p className="text-xs">Kein Headerbild gewählt</p>
          </div>
        </div>
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
          onUploaded={handleUploaded}
          label="Neues Bild hochladen"
          className="fca-button-secondary text-xs"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="fca-button-secondary text-xs text-rose-600"
          >
            Headerbild entfernen
          </button>
        )}
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectionMode="single"
        mediaTypes={["image"]}
        onSelect={handleSelect}
        title="Headerbild auswählen"
      />
    </div>
  );
}
