"use client";

/**
 * SharedMediaPicker — Reusable DAM asset picker dialog.
 *
 * This is the single underlying picker dialog implementation for the whole
 * app. Supports:
 * - Browse all assets with search + folder + type filters
 * - Single or multi-select
 * - Upload new assets from within the picker
 * - Keyboard shortcuts (Escape closes the dialog)
 * - Returns normalized MediaAssetListItem
 *
 * Prefer using MediaPickerDialog (components/admin/media/MediaPickerDialog.tsx)
 * for new module integrations — it wraps this component with a small,
 * module-agnostic API (selectionMode / mediaTypes / onSelect) so every
 * consumer shares the exact same browsing/search/upload experience without
 * duplicating picker logic. This component remains the implementation both
 * MediaPickerDialog and existing call sites render.
 *
 * Usage:
 *   <SharedMediaPicker
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onSelect={(asset) => handleSelect(asset)}
 *   />
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ImageIcon,
  Film,
  Search,
  FolderOpen,
  X,
  Upload,
  Loader2,
  ChevronRight,
  Check,
} from "lucide-react";
import type { MediaAssetListItem, MediaFolderItem } from "@/lib/media/types";
import { validateMediaUploadFile, ALLOWED_MEDIA_MIME_TYPES } from "@/lib/media/types";

type FilterType = "ALL" | "IMAGE" | "VIDEO";

type SharedMediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAssetListItem) => void;
  onSelectMultiple?: (assets: MediaAssetListItem[]) => void;
  multiSelect?: boolean;
  filterType?: "IMAGE" | "VIDEO";
  title?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SharedMediaPicker({
  open,
  onClose,
  onSelect,
  onSelectMultiple,
  multiSelect = false,
  filterType,
  title = "Medium auswählen",
}: SharedMediaPickerProps) {
  const [assets, setAssets] = useState<MediaAssetListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [folders, setFolders] = useState<MediaFolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>(filterType ?? "ALL");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, type: FilterType, folderId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (type !== "ALL") params.set("type", type);
      if (folderId) params.set("folderId", folderId);
      if (q) params.set("q", q);
      const res = await fetch(`/api/media?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler beim Laden");
      setAssets(data.assets ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/media/folders");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFolders(data.folders ?? []);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch("");
    setActiveFolderId(null);
    load("", typeFilter, null);
    loadFolders();
  }, [open, load, typeFilter, loadFolders]);

  // Keyboard shortcuts — shared by every consumer of this dialog (Hero Image,
  // Weitere Medien, Homepage Builder, Page Builder, CMS layout, etc.).
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      load(search, typeFilter, activeFolderId);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, typeFilter, activeFolderId, load, open]);

  function handleSelect(asset: MediaAssetListItem) {
    if (multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(asset.id)) next.delete(asset.id);
        else next.add(asset.id);
        return next;
      });
    } else {
      onSelect(asset);
      onClose();
    }
  }

  function handleConfirmMulti() {
    const picks = assets.filter((a) => selected.has(a.id));
    if (onSelectMultiple) {
      onSelectMultiple(picks);
    } else if (picks.length > 0) {
      onSelect(picks[0]);
    }
    onClose();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateMediaUploadFile(file);
    if (!v.ok) { setUploadError(v.error); return; }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (activeFolderId) fd.append("folderId", activeFolderId);
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setUploadError(data?.error ?? "Upload fehlgeschlagen."); return; }
      const newAsset = data.asset as MediaAssetListItem;
      setAssets((prev) => [newAsset, ...prev]);
      setTotal((t) => t + 1);
    } catch {
      setUploadError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const rootFolders = folders.filter((f) => !f.parentId);
  const childFolders = folders.filter((f) => f.parentId === activeFolderId);
  const activeFolder = folders.find((f) => f.id === activeFolderId);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-[var(--tenant-primary)]" />
            <span className="font-semibold text-[var(--foreground)]">{title}</span>
            {total > 0 && (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                {total} Medien
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — folders */}
          <div className="hidden w-48 flex-shrink-0 overflow-y-auto border-r border-[var(--border)] p-3 md:block">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Ordner
            </p>
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className={`mb-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition ${
                activeFolderId === null
                  ? "bg-[var(--tenant-primary)] text-white"
                  : "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Alle Medien
            </button>
            {rootFolders.map((f) => (
              <FolderNode
                key={f.id}
                folder={f}
                allFolders={folders}
                activeId={activeFolderId}
                onSelect={setActiveFolderId}
                depth={0}
              />
            ))}
          </div>

          {/* Main area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Suche…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-8 pr-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
                />
              </div>

              {/* Type filter */}
              {!filterType && (
                <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs">
                  {(["ALL", "IMAGE", "VIDEO"] as FilterType[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTypeFilter(f)}
                      className={`rounded-md px-2.5 py-1 transition ${
                        typeFilter === f
                          ? "bg-[var(--surface)] shadow-sm"
                          : "text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {f === "ALL" ? "Alle" : f === "IMAGE" ? "Bilder" : "Videos"}
                    </button>
                  ))}
                </div>
              )}

              {/* Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="fca-button-secondary py-1.5 text-xs"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "…" : "Hochladen"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_MEDIA_MIME_TYPES.join(", ")}
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            {/* Breadcrumb + folder children */}
            {activeFolderId && (
              <div className="flex items-center gap-1 border-b border-[var(--border)] px-4 py-1.5 text-xs text-[var(--muted)]">
                <button
                  type="button"
                  onClick={() => setActiveFolderId(null)}
                  className="hover:text-[var(--foreground)]"
                >
                  Alle Medien
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="text-[var(--foreground)]">{activeFolder?.name}</span>
              </div>
            )}

            {/* Sub-folders row */}
            {activeFolderId === null && childFolders.length === 0 && folders.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-4 py-2">
                {rootFolders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFolderId(f.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs hover:border-[var(--tenant-primary)] hover:bg-[var(--surface)]"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-[var(--tenant-primary)]" />
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {(error || uploadError) && (
              <div className="mx-4 mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error ?? uploadError}
              </div>
            )}

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading && assets.length === 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="aspect-video animate-pulse rounded-xl bg-[var(--surface-2)]" />
                  ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-[var(--muted)]">
                  <ImageIcon className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Keine Medien gefunden.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {assets.map((asset) => {
                    const isSelected = selected.has(asset.id);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleSelect(asset)}
                        className={`group relative flex flex-col overflow-hidden rounded-xl border-2 transition hover:shadow-md ${
                          isSelected
                            ? "border-[var(--tenant-primary)] shadow-md"
                            : "border-[var(--border)] hover:border-[var(--tenant-primary)]"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-video w-full bg-[var(--surface-2)]">
                          {asset.type === "IMAGE" ? (
                            <img
                              src={asset.url}
                              alt={asset.altText ?? asset.filename}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Film className="h-6 w-6 text-[var(--muted)]" />
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[var(--tenant-primary)]/20">
                              <div className="rounded-full bg-[var(--tenant-primary)] p-1">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Name */}
                        <div className="p-1.5">
                          <p className="truncate text-[10px] font-medium text-[var(--foreground)]">
                            {asset.filename}
                          </p>
                          <p className="text-[9px] text-[var(--muted)]">
                            {formatBytes(asset.sizeBytes)}
                            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {multiSelect && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
            <span className="text-sm text-[var(--muted)]">
              {selected.size > 0 ? `${selected.size} ausgewählt` : "Kein Medium ausgewählt"}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="fca-button-secondary">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmMulti}
                disabled={selected.size === 0}
                className="fca-button-primary"
              >
                Übernehmen ({selected.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FolderNode ─────────────────────────────────────────────────────────────────

function FolderNode({
  folder,
  allFolders,
  activeId,
  onSelect,
  depth,
}: {
  folder: MediaFolderItem;
  allFolders: MediaFolderItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(folder.id)}
        style={{ paddingLeft: `${(depth + 1) * 8 + 8}px` }}
        className={`mb-0.5 flex w-full items-center gap-1.5 rounded-md pr-2 py-1.5 text-xs transition ${
          activeId === folder.id
            ? "bg-[var(--tenant-primary)] text-white"
            : "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
        }`}
      >
        <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{folder.name}</span>
      </button>
      {children.map((child) => (
        <FolderNode
          key={child.id}
          folder={child}
          allFolders={allFolders}
          activeId={activeId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </>
  );
}
