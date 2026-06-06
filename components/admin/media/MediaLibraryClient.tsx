"use client";

import { useState, useTransition, useCallback } from "react";
import { FileText, Archive, Eye, Pencil, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import MediaUploader from "./MediaUploader";
import type { MediaAssetListItem } from "@/lib/media/queries";


type Props = {
  assets: MediaAssetListItem[];
  total: number;
};

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Alle" },
  { value: "IMAGE", label: "Bilder" },
  { value: "VIDEO", label: "Videos" },
  { value: "DOCUMENT", label: "Dokumente" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaLibraryClient({ assets: initialAssets, total: initialTotal }: Props) {

  const [isPending, startTransition] = useTransition();
  const [assets, setAssets] = useState(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [viewingAsset, setViewingAsset] = useState<MediaAssetListItem | null>(null);

  const reload = useCallback(() => {
    startTransition(async () => {
      const url = `/api/media?status=ACTIVE${typeFilter ? `&type=${typeFilter}` : ""}&limit=200`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets ?? []);
        setTotal(data.total ?? 0);
      }
    });
  }, [typeFilter]);

  function handleArchive(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      if (res.ok) reload();
    });
  }

  function startRename(asset: MediaAssetListItem) {
    setRenamingId(asset.id);
    setRenameName(asset.name);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameName("");
  }

  function handleRename(id: string) {
    if (!renameName.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      if (res.ok) {
        setAssets((prev) =>
          prev.map((a) => (a.id === id ? { ...a, name: renameName.trim() } : a)),
        );
        cancelRename();
      }
    });
  }

  const filtered = assets.filter((a) => !typeFilter || a.type === typeFilter);

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <MediaUploader onUploaded={reload} />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setTypeFilter(f.value);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-[var(--blue)] text-white"
                  : "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">{filtered.length} von {total} Assets</p>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
          <p className="text-sm text-[var(--muted)]">Keine Medien gefunden.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isRenaming={renamingId === asset.id}
              renameName={renameName}
              onRenameChange={setRenameName}
              onStartRename={() => startRename(asset)}
              onConfirmRename={() => handleRename(asset.id)}
              onCancelRename={cancelRename}
              onArchive={() => handleArchive(asset.id)}
              onView={() => setViewingAsset(asset)}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* View dialog */}
      {viewingAsset && (
        <AssetViewDialog asset={viewingAsset} onClose={() => setViewingAsset(null)} />
      )}
    </div>
  );
}

function AssetCard({
  asset,
  isRenaming,
  renameName,
  onRenameChange,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onArchive,
  onView,
  isPending,
}: {
  asset: MediaAssetListItem;
  isRenaming: boolean;
  renameName: string;
  onRenameChange: (v: string) => void;
  onStartRename: () => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onArchive: () => void;
  onView: () => void;
  isPending: boolean;
}) {
  const isImage = asset.type === "IMAGE";

  return (
    <div className="group relative rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)] overflow-hidden">
      {/* Preview */}
      <div
        className="relative aspect-video bg-[var(--background)] cursor-pointer"
        onClick={onView}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.storagePath}
            alt={asset.altText ?? asset.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileText className="h-12 w-12 text-[var(--muted)]" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button
            onClick={onView}
            className="rounded-full bg-white/90 p-2 shadow-md text-[var(--foreground)] hover:bg-white transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        {isRenaming ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={renameName}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirmRename();
                if (e.key === "Escape") onCancelRename();
              }}
              autoFocus
              className="flex-1 min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
            />
            <button
              onClick={onConfirmRename}
              disabled={isPending}
              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onCancelRename}
              className="p-1 rounded text-[var(--muted)] hover:bg-[var(--background)] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-xs font-medium text-[var(--foreground)] truncate">{asset.name}</p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <div>
            <p className="text-[0.65rem] text-[var(--muted)] truncate">{asset.fileName}</p>
            <p className="text-[0.65rem] text-[var(--muted)]">
              {formatBytes(asset.fileSize)} ·{" "}
              {formatDistanceToNow(new Date(asset.createdAt), { locale: de, addSuffix: true })}
            </p>
          </div>

          <div className="flex gap-1 shrink-0">
            <button
              onClick={onStartRename}
              title="Umbenennen"
              disabled={isPending}
              className="p-1 rounded text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onArchive}
              title="Archivieren"
              disabled={isPending}
              className="p-1 rounded text-[var(--muted)] hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Upload info */}
        {asset.createdBy && (
          <p className="mt-1 text-[0.6rem] text-[var(--muted)]">
            {asset.createdBy.firstName} {asset.createdBy.lastName}
          </p>
        )}
      </div>
    </div>
  );
}

function AssetViewDialog({
  asset,
  onClose,
}: {
  asset: MediaAssetListItem;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full mx-4 rounded-[var(--radius-xl)] bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{asset.name}</h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">{asset.fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--background)] text-[var(--muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        {asset.type === "IMAGE" && (
          <div className="bg-[var(--background)] p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
              src={asset.storagePath}
              alt={asset.altText ?? asset.name}
              className="mx-auto max-h-[60vh] rounded-[var(--radius-md)] object-contain"
            />
          </div>
        )}

        {/* Meta */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3 text-xs">
          <MetaItem label="Typ" value={asset.mimeType} />
          <MetaItem label="Grösse" value={`${(asset.fileSize / 1024 / 1024).toFixed(2)} MB`} />
          <MetaItem label="Speicher" value={asset.storageProvider} />
          <MetaItem label="Status" value={asset.status} />
          {asset.altText && <MetaItem label="Alt-Text" value={asset.altText} />}
          <div className="col-span-2">
            <span className="text-[var(--muted)] font-medium">URL</span>
            <p className="mt-0.5 font-mono text-[0.65rem] break-all text-[var(--foreground)]">
              {asset.storagePath}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[var(--muted)] font-medium">{label}</span>
      <p className="mt-0.5 text-[var(--foreground)]">{value}</p>
    </div>
  );
}
