"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Film,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  X,
  CheckCircle2,
} from "lucide-react";
import { validateMediaUploadFile, ALLOWED_MEDIA_MIME_TYPES } from "@/lib/media/types";
import type { MediaAssetListItem } from "@/lib/media/types";

// ── Types ────────────────────────────────────────────────────────────────────

type FilterType = "ALL" | "IMAGE" | "VIDEO";

export type MediaPickerValue = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
};

type MediaLibraryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: MediaPickerValue) => void;
  /** Currently selected asset id — highlighted in the grid */
  selectedId?: string | null;
  title?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MediaLibraryModal({
  isOpen,
  onClose,
  onSelect,
  selectedId,
  title = "Mediathek",
}: MediaLibraryModalProps) {
  const [assets, setAssets] = useState<MediaAssetListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(selectedId ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setPendingId(selectedId ?? null);
  }, [isOpen, selectedId]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
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
    if (isOpen) loadAssets();
  }, [isOpen, loadAssets]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateMediaUploadFile(file);
    if (!validation.ok) {
      setUploadError(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setUploadError(data?.error ?? "Upload fehlgeschlagen."); return; }
      const newAsset: MediaAssetListItem = data.asset;
      setAssets((prev) => [newAsset, ...prev]);
      setTotal((t) => t + 1);
      setPendingId(newAsset.id);
    } catch {
      setUploadError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleConfirm() {
    const asset = assets.find((a) => a.id === pendingId);
    if (!asset) return;
    onSelect({ id: asset.id, url: asset.url, altText: asset.altText, filename: asset.filename });
    onClose();
  }

  const lowerSearch = search.toLowerCase().trim();
  const visibleAssets = lowerSearch
    ? assets.filter((a) => a.filename.toLowerCase().includes(lowerSearch))
    : assets;

  const pendingAsset = assets.find((a) => a.id === pendingId) ?? null;

  if (!isOpen) return null;

  const filterLabels: Record<FilterType, string> = { ALL: "Alle", IMAGE: "Bilder", VIDEO: "Videos" };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-[1100px] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--surface)] shadow-[var(--shadow-xl)]"
        style={{ height: "clamp(520px, 88vh, 920px)" }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-2)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--tenant-primary)_12%,transparent)]">
              <ImageIcon className="h-4 w-4 text-[var(--tenant-primary)]" />
            </div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
            {!loading && (
              <span className="rounded-[var(--radius-pill)] bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                {total}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="sce-icon-button" aria-label="Schliessen">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] px-6 py-3">
          <div className="sce-page-search h-9 max-w-xs flex-1 text-sm">
            <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input ref={searchInputRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Dateiname suchen…" />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="ml-auto shrink-0 text-[var(--muted)] hover:text-[var(--foreground)]">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-medium">
            {(["ALL", "IMAGE", "VIDEO"] as FilterType[]).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-3 py-1.5 transition-all ${filter === f ? "bg-[var(--surface)] shadow-sm text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                {f === "IMAGE" && <ImageIcon className="h-3 w-3" />}
                {f === "VIDEO" && <Film className="h-3 w-3" />}
                {filterLabels[f]}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="fca-button-secondary gap-1.5 text-xs">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Hochladen…" : "Bild hochladen"}
          </button>
          <input ref={fileInputRef} type="file" accept={ALLOWED_MEDIA_MIME_TYPES.join(", ")} className="hidden" onChange={handleFileSelect} />

          <button type="button" onClick={loadAssets} disabled={loading} className="sce-icon-button h-9 w-9" title="Aktualisieren">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {uploadError && (
          <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs font-medium text-rose-700">{uploadError}</div>
        )}

        {/* Body */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error ? (
              <div className="flex flex-col items-center gap-3 py-20 text-[var(--muted)]">
                <p className="text-sm text-rose-600">{error}</p>
                <button type="button" onClick={loadAssets} className="fca-button-secondary text-xs">Erneut versuchen</button>
              </div>
            ) : loading && assets.length === 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]" />
                ))}
              </div>
            ) : visibleAssets.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-[var(--muted)]">
                <ImageIcon className="h-12 w-12 opacity-20" />
                {search ? (
                  <>
                    <p className="text-sm font-medium">Keine Ergebnisse für „{search}"</p>
                    <button type="button" onClick={() => setSearch("")} className="fca-button-secondary text-xs">Suche zurücksetzen</button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Noch keine Medien vorhanden.</p>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="fca-button-primary text-xs">
                      <Upload className="h-3.5 w-3.5" />Erste Datei hochladen
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {visibleAssets.map((asset) => (
                  <ModalAssetCard key={asset.id} asset={asset} isSelected={asset.id === pendingId}
                    onSelect={() => setPendingId(asset.id === pendingId ? null : asset.id)} />
                ))}
              </div>
            )}
          </div>

          {pendingAsset && (
            <div className="w-64 shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface-2)]">
              <SelectedAssetPanel asset={pendingAsset} onClear={() => setPendingId(null)} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-6 py-4">
          <p className="text-[11px] text-[var(--muted)]">
            {!loading && visibleAssets.length > 0 ? `${visibleAssets.length} von ${total} Medien` : ""}
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="fca-button-secondary text-sm">Abbrechen</button>
            <button type="button" onClick={handleConfirm} disabled={!pendingId} className="fca-button-primary text-sm">
              <CheckCircle2 className="h-4 w-4" />Auswählen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ModalAssetCard ────────────────────────────────────────────────────────────

function ModalAssetCard({ asset, isSelected, onSelect }: { asset: MediaAssetListItem; isSelected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect}
      className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] border-2 bg-[var(--surface)] text-left transition-all ${
        isSelected
          ? "border-[var(--tenant-primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--tenant-primary)_15%,transparent)]"
          : "border-[var(--border)] hover:border-[color-mix(in_srgb,var(--tenant-primary)_40%,var(--border))] hover:shadow-sm"
      }`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-2)]">
        {asset.type === "IMAGE" ? (
          <img src={asset.url} alt={asset.altText ?? asset.filename}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--muted)]">
            <Film className="h-10 w-10 opacity-50" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Video</span>
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--tenant-primary)_20%,transparent)]">
            <div className="rounded-full bg-[var(--tenant-primary)] p-1.5 shadow-md">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <p className={`truncate text-xs font-medium ${isSelected ? "text-[var(--tenant-primary)]" : "text-[var(--foreground)]"}`} title={asset.filename}>
          {asset.filename}
        </p>
        <p className="text-[10px] text-[var(--muted)]">
          {formatBytes(asset.sizeBytes)}{asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
        </p>
      </div>
    </button>
  );
}

// ── SelectedAssetPanel ────────────────────────────────────────────────────────

function SelectedAssetPanel({ asset, onClear }: { asset: MediaAssetListItem; onClear: () => void }) {
  return (
    <div className="flex flex-col gap-0 p-4">
      <div className="mb-4 overflow-hidden rounded-[var(--radius-xl)] border-2 border-[var(--tenant-primary)] bg-[var(--surface-2)]">
        {asset.type === "IMAGE" ? (
          <img src={asset.url} alt={asset.altText ?? asset.filename} className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-[var(--muted)]">
            <Film className="h-10 w-10 opacity-40" />
            <span className="text-[10px] font-semibold uppercase">Video</span>
          </div>
        )}
      </div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Ausgewählt</p>
      <div className="mb-4 space-y-2.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3">
        <DataRow label="Datei" value={asset.filename} truncate />
        <DataRow label="Typ" value={asset.type === "IMAGE" ? "Bild" : "Video"} />
        <DataRow label="Grösse" value={formatBytes(asset.sizeBytes)} />
        {asset.width && asset.height ? <DataRow label="Auflösung" value={`${asset.width} × ${asset.height}`} /> : null}
        {asset.mimeType ? <DataRow label="Format" value={asset.mimeType.split("/")[1]?.toUpperCase() ?? asset.mimeType} /> : null}
      </div>
      <button type="button" onClick={onClear} className="fca-button-secondary w-full text-xs text-rose-600">
        <X className="h-3.5 w-3.5" />Auswahl aufheben
      </button>
    </div>
  );
}

function DataRow({ label, value, truncate = false }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</span>
      <span className={`text-xs font-medium text-[var(--foreground)] ${truncate ? "truncate" : "break-all"}`} title={truncate ? value : undefined}>
        {value}
      </span>
    </div>
  );
}
