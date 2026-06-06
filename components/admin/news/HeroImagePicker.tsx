"use client";

import { useState, useEffect, useCallback } from "react";
import { Image, X, Search, Upload } from "lucide-react";
import type { MediaAssetListItem } from "@/lib/media/queries";

type Props = {
  selectedId: string | null;
  selectedAsset: Pick<MediaAssetListItem, "id" | "name" | "storagePath" | "altText"> | null;
  onSelect: (asset: MediaAssetListItem | null) => void;
};

export default function HeroImagePicker({ selectedId, selectedAsset, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAssetListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media?type=IMAGE&status=ACTIVE&limit=100");
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadAssets();
  }, [open, loadAssets]);

  const filtered = assets.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.fileName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      {/* Current selection */}
      {selectedAsset ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedAsset.storagePath}
            alt={selectedAsset.altText ?? selectedAsset.name}
            className="h-20 w-28 rounded-[var(--radius-md)] object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">
              {selectedAsset.name}
            </p>
            <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
              {selectedAsset.storagePath.split("/").pop()}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
            >
              Ändern
            </button>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="rounded-[var(--radius-md)] border border-[var(--border)] p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-center hover:border-[var(--blue)] hover:bg-[var(--blue-light)] transition-colors group"
        >
          <Image className="h-8 w-8 text-[var(--muted)] group-hover:text-[var(--blue)] transition-colors mx-auto" />
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Bild aus Mediathek wählen</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Klicken um ein Bild aus der Medien-Bibliothek auszuwählen
            </p>
          </div>
        </button>
      )}

      {/* Picker dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-[var(--radius-xl)] bg-white shadow-2xl mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h3 className="text-base font-semibold text-[var(--foreground)]">
                Bild aus Mediathek wählen
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--background)] text-[var(--muted)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Bilder suchen…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                />
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="text-sm text-[var(--muted)]">Lade Bilder…</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Image className="h-10 w-10 text-[var(--muted)] mb-3" />
                  <p className="text-sm text-[var(--muted)]">
                    {assets.length === 0
                      ? "Noch keine Bilder in der Mediathek."
                      : "Keine Bilder für die Suche gefunden."}
                  </p>
                  <a
                    href="/dashboard/website/media"
                    target="_blank"
                    className="mt-2 text-xs text-[var(--blue)] hover:underline inline-flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    Bilder hochladen
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {filtered.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        onSelect(asset);
                        setOpen(false);
                      }}
                      className={`group relative aspect-video overflow-hidden rounded-[var(--radius-md)] border-2 transition-all ${
                        selectedId === asset.id
                          ? "border-[var(--blue)] ring-2 ring-[var(--blue)] ring-offset-1"
                          : "border-[var(--border)] hover:border-[var(--blue)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.storagePath}
                        alt={asset.altText ?? asset.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                        <p className="text-[0.6rem] text-white truncate leading-tight">
                          {asset.name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-md)] border border-[var(--border)] px-3.5 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
