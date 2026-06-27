"use client";

/**
 * MediaLibraryDAM — Premium Digital Asset Management UI.
 *
 * Full-featured DAM experience:
 * - Folder tree sidebar
 * - Search, type filter, tag filter, archived toggle
 * - Grid/list view toggle
 * - Drag-and-drop upload
 * - Asset detail drawer with metadata editor, tags, usage tracking
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search,
  Upload,
  LayoutGrid,
  LayoutList,
  Filter,
  RefreshCw,
  ImageIcon,
  Film,
  FolderOpen,
  ChevronRight,
  X,
  ArchiveRestore,
  PanelRight,
  SlidersHorizontal,
} from "lucide-react";
import type {
  MediaAssetListItem,
  MediaAssetDetail,
  MediaFolderItem,
  MediaFolderTree,
  MediaTagItem,
} from "@/lib/media/types";
import { buildFolderTree } from "@/lib/media/utils";
import MediaFolderSidebar from "@/components/admin/media/MediaFolderSidebar";
import MediaDropZone from "@/components/admin/media/MediaDropZone";
import MediaAssetDetailDrawer from "@/components/admin/media/MediaAssetDetailDrawer";

type ViewMode = "grid" | "list";
type FilterType = "ALL" | "IMAGE" | "VIDEO";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryDAM() {
  // State
  const [assets, setAssets] = useState<MediaAssetListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolderItem[]>([]);
  const [folderTree, setFolderTree] = useState<MediaFolderTree[]>([]);
  const [tags, setTags] = useState<MediaTagItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showUpload, setShowUpload] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load assets ─────────────────────────────────────────────────────────────

  const loadAssets = useCallback(async (
    q: string,
    type: FilterType,
    folderId: string | null,
    tagIds: string[],
    archived: boolean,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (type !== "ALL") params.set("type", type);
      if (folderId) params.set("folderId", folderId);
      if (tagIds.length > 0) params.set("tagIds", tagIds.join(","));
      if (q) params.set("q", q);
      if (archived) params.set("archived", "1");
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
      if (res.ok) {
        const flat: MediaFolderItem[] = data.folders ?? [];
        setFolders(flat);
        setFolderTree(buildFolderTree(flat));
      }
    } catch { /* non-fatal */ }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch("/api/media/tags");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTags(data.tags ?? []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadFolders();
    loadTags();
  }, [loadFolders, loadTags]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadAssets(search, typeFilter, activeFolderId, activeTagIds, showArchived);
    }, search ? 300 : 0);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, typeFilter, activeFolderId, activeTagIds, showArchived, loadAssets]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function openDetail(asset: MediaAssetListItem) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/media/${asset.id}?archived=1`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSelectedAsset(data.asset);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleUploaded(asset: MediaAssetListItem) {
    setAssets((prev) => [asset, ...prev]);
    setTotal((t) => t + 1);
  }

  function handleUpdated(updated: MediaAssetDetail) {
    setAssets((prev) =>
      prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
    );
    setSelectedAsset(updated);
  }

  function handleArchived(id: string) {
    if (!showArchived) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } else {
      setAssets((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "ARCHIVED" } : a)),
      );
    }
    setSelectedAsset((prev) =>
      prev?.id === id ? { ...prev, status: "ARCHIVED" } : prev,
    );
  }

  function handleRestored(asset: MediaAssetDetail) {
    setSelectedAsset(asset);
    setAssets((prev) =>
      prev.map((a) => (a.id === asset.id ? { ...a, status: "ACTIVE" } : a)),
    );
  }

  function toggleTag(id: string) {
    setActiveTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  // ── Breadcrumb ───────────────────────────────────────────────────────────────

  function getBreadcrumb(): { id: string | null; name: string }[] {
    if (!activeFolderId) return [];
    const crumbs: { id: string | null; name: string }[] = [];
    let current: MediaFolderItem | undefined = folders.find((f) => f.id === activeFolderId);
    while (current) {
      crumbs.unshift({ id: current.id, name: current.name });
      current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined;
    }
    return crumbs;
  }

  const breadcrumb = getBreadcrumb();
  const activeFolder = folders.find((f) => f.id === activeFolderId);
  const hasFilters = typeFilter !== "ALL" || activeTagIds.length > 0 || showArchived;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)]">
      {/* Left sidebar — folders */}
      {sidebarOpen && (
        <div className="hidden w-56 flex-shrink-0 flex-col border-r border-[var(--border)] lg:flex">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Ordner
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <MediaFolderSidebar
              tree={folderTree}
              activeFolderId={activeFolderId}
              onSelectFolder={setActiveFolderId}
              onFoldersChange={() => { loadFolders(); }}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
          {/* Sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="hidden rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] lg:block"
            title="Ordner ein-/ausblenden"
          >
            <PanelRight className="h-4 w-4" />
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Suche nach Name, Alt-Text, Beschreibung…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="fca-input w-full py-1.5 pl-8 pr-8 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-medium">
            {(["ALL", "IMAGE", "VIDEO"] as FilterType[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                  typeFilter === f
                    ? "bg-[var(--surface)] shadow-sm text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {f === "IMAGE" && <ImageIcon className="h-3 w-3" />}
                {f === "VIDEO" && <Film className="h-3 w-3" />}
                {f === "ALL" ? "Alle" : f === "IMAGE" ? "Bilder" : "Videos"}
              </button>
            ))}
          </div>

          {/* Filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((o) => !o)}
            className={`rounded-lg border p-1.5 transition ${
              hasFilters
                ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10 text-[var(--tenant-primary)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            }`}
            title="Filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {/* View mode */}
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 transition ${viewMode === "grid" ? "bg-[var(--surface)] shadow-sm" : "text-[var(--muted)]"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 transition ${viewMode === "list" ? "bg-[var(--surface)] shadow-sm" : "text-[var(--muted)]"}`}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => loadAssets(search, typeFilter, activeFolderId, activeTagIds, showArchived)}
            disabled={loading}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)] disabled:opacity-50"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Upload */}
          <button
            type="button"
            onClick={() => setShowUpload((o) => !o)}
            className={`fca-button-primary py-1.5 text-sm ${showUpload ? "opacity-80" : ""}`}
          >
            <Upload className="h-4 w-4" />
            Hochladen
          </button>
        </div>

        {/* Filters bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[var(--muted)]">Tags:</span>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                      activeTagIds.includes(tag.id)
                        ? "bg-[var(--tenant-primary)] text-white"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)]"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            {/* Archived toggle */}
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
              <div
                onClick={() => setShowArchived((o) => !o)}
                className={`relative h-4 w-7 rounded-full transition ${
                  showArchived ? "bg-[var(--tenant-primary)]" : "bg-[var(--border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    showArchived ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </div>
              Archivierte anzeigen
            </label>

            {/* Clear filters */}
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("ALL");
                  setActiveTagIds([]);
                  setShowArchived(false);
                }}
                className="text-[11px] text-rose-600 hover:underline"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {/* Upload zone */}
        {showUpload && (
          <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-4">
            <MediaDropZone
              folderId={activeFolderId}
              onUploaded={handleUploaded}
              onAllDone={() => setShowUpload(false)}
            />
          </div>
        )}

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 border-b border-[var(--border)] px-4 py-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Alle Medien
            </button>
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.id ?? "root"} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-[var(--muted)]" />
                {i < breadcrumb.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(crumb.id)}
                    className="text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    {crumb.name}
                  </button>
                ) : (
                  <span className="font-medium text-[var(--foreground)]">{crumb.name}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Asset area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Grid/list */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Error */}
            {error && (
              <div className="mb-4 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {/* Count bar */}
            {!loading && (
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] text-[var(--muted)]">
                  {total > 0 ? (
                    <>
                      <span className="font-medium text-[var(--foreground)]">{total}</span>{" "}
                      {total === 1 ? "Medium" : "Medien"}
                      {activeFolder ? ` in „${activeFolder.name}"` : ""}
                      {search ? ` für „${search}"` : ""}
                    </>
                  ) : null}
                </p>
              </div>
            )}

            {loading && assets.length === 0 ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-video animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                  ))}
                </div>
              )
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-[var(--muted)]">
                <div className="rounded-[var(--radius-2xl)] bg-[var(--surface-2)] p-6">
                  <ImageIcon className="h-12 w-12 opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {search || hasFilters
                      ? "Keine Medien gefunden"
                      : "Noch keine Medien vorhanden"}
                  </p>
                  <p className="mt-1 text-xs">
                    {search || hasFilters
                      ? "Versuche andere Suchbegriffe oder Filter."
                      : "Lade deine ersten Dateien hoch, um loszulegen."}
                  </p>
                </div>
                {!search && !hasFilters && (
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="fca-button-primary"
                  >
                    <Upload className="h-4 w-4" />
                    Erste Datei hochladen
                  </button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {assets.map((asset) => (
                  <AssetGridCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedAsset?.id === asset.id}
                    onClick={() => openDetail(asset)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {assets.map((asset) => (
                  <AssetListRow
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedAsset?.id === asset.id}
                    onClick={() => openDetail(asset)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail drawer */}
          {(selectedAsset || detailLoading) && (
            <div className="hidden w-80 flex-shrink-0 border-l border-[var(--border)] xl:flex xl:flex-col">
              {detailLoading ? (
                <div className="flex h-full items-center justify-center">
                  <RefreshCw className="h-5 w-5 animate-spin text-[var(--muted)]" />
                </div>
              ) : selectedAsset ? (
                <MediaAssetDetailDrawer
                  asset={selectedAsset}
                  folders={folders}
                  tags={tags}
                  onClose={() => setSelectedAsset(null)}
                  onUpdated={handleUpdated}
                  onArchived={handleArchived}
                  onRestored={handleRestored}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AssetGridCard ─────────────────────────────────────────────────────────────

function AssetGridCard({
  asset,
  isSelected,
  onClick,
}: {
  asset: MediaAssetListItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isArchived = "status" in asset && (asset as MediaAssetListItem & { status?: string }).status === "ARCHIVED";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] border-2 transition hover:shadow-md ${
        isSelected
          ? "border-[var(--tenant-primary)] shadow-md"
          : "border-[var(--border)] hover:border-[var(--tenant-primary)]"
      } ${isArchived ? "opacity-50" : ""}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-[var(--surface-2)]">
        {asset.type === "IMAGE" ? (
          <img
            src={asset.url}
            alt={asset.altText ?? asset.filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-7 w-7 text-[var(--muted)]" />
          </div>
        )}

        {/* Type badge */}
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
          {asset.type === "IMAGE" ? <ImageIcon className="h-2 w-2" /> : <Film className="h-2 w-2" />}
          {asset.type === "IMAGE" ? "Bild" : "Video"}
        </span>

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute inset-0 bg-[var(--tenant-primary)]/10" />
        )}

        {/* Tags overlay */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="absolute bottom-1 right-1 flex gap-0.5">
            {asset.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-white"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-0.5 p-2">
        <p className="truncate text-[11px] font-medium text-[var(--foreground)]" title={asset.filename}>
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
    </button>
  );
}

// ── AssetListRow ──────────────────────────────────────────────────────────────

function AssetListRow({
  asset,
  isSelected,
  onClick,
}: {
  asset: MediaAssetListItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isArchived = "status" in asset && (asset as MediaAssetListItem & { status?: string }).status === "ARCHIVED";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:shadow-sm ${
        isSelected
          ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/5"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
      } ${isArchived ? "opacity-50" : ""}`}
    >
      {/* Thumbnail */}
      <div className="h-10 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
        {asset.type === "IMAGE" ? (
          <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-4 w-4 text-[var(--muted)]" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">{asset.filename}</p>
        <p className="text-[11px] text-[var(--muted)]">
          {formatBytes(asset.sizeBytes)}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
          {" · "}
          {new Date(asset.createdAt).toLocaleDateString("de-CH")}
        </p>
      </div>

      {/* Tags */}
      {asset.tags && asset.tags.length > 0 && (
        <div className="hidden items-center gap-1 md:flex">
          {asset.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Archived badge */}
      {isArchived && (
        <span className="flex-shrink-0">
          <ArchiveRestore className="h-4 w-4 text-[var(--muted)]" />
        </span>
      )}

      {/* Type badge */}
      <span className="hidden flex-shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] uppercase font-medium text-[var(--muted)] sm:inline-block">
        {asset.type}
      </span>
    </button>
  );
}
