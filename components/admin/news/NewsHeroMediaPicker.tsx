"use client";

import { useState } from "react";
import { ImageIcon, X, FolderOpen } from "lucide-react";
import MediaLibraryModal from "@/components/admin/media/MediaLibraryModal";
import type { MediaPickerValue } from "@/components/admin/media/MediaLibraryModal";

type NewsHeroMediaPickerProps = {
  value: { id: string; url: string; altText: string | null; filename: string } | null;
  onChange: (asset: { id: string; url: string; altText: string | null; filename: string } | null) => void;
};

export default function NewsHeroMediaPicker({ value, onChange }: NewsHeroMediaPickerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  function handleSelect(asset: MediaPickerValue) {
    onChange({ id: asset.id, url: asset.url, altText: asset.altText, filename: asset.filename });
  }

  return (
    <>
      <div className="space-y-3">
        {/* Current selection preview */}
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
                onClick={() => onChange(null)}
                className="ml-2 rounded-full bg-white/20 p-1 text-white transition hover:bg-white/40"
                title="Headerbild entfernen"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex h-36 w-full items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] transition hover:border-[var(--tenant-primary)] hover:bg-[color-mix(in_srgb,var(--tenant-primary)_4%,var(--surface-2))]"
          >
            <div className="flex flex-col items-center gap-2">
              <ImageIcon className="h-7 w-7 opacity-35" />
              <p className="text-xs font-medium">Klicken um Bild zu wählen</p>
            </div>
          </button>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="fca-button-secondary text-xs"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {value ? "Bild wechseln" : "Aus Bibliothek wählen"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="fca-button-secondary text-xs text-rose-600"
            >
              <X className="h-3.5 w-3.5" />
              Entfernen
            </button>
          )}
        </div>
      </div>

      {/* Media Library Modal */}
      <MediaLibraryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelect}
        selectedId={value?.id}
        title="Headerbild wählen"
      />
    </>
  );
}
