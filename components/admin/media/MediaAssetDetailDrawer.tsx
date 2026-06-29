"use client";

import { useState, useEffect } from "react";
import {
  X,
  Download,
  Copy,
  Archive,
  RotateCcw,
  Loader2,
  Film,
  ImageIcon,
  MapPin,
  Tag,
  Info,
  Link2,
  CheckCircle2,
} from "lucide-react";
import type { MediaAssetDetail, MediaTagItem, MediaFolderItem, MediaAssetUsageItem } from "@/lib/media/types";

type MediaAssetDetailDrawerProps = {
  asset: MediaAssetDetail | null;
  folders: MediaFolderItem[];
  tags: MediaTagItem[];
  onClose: () => void;
  onUpdated: (asset: MediaAssetDetail) => void;
  onArchived: (id: string) => void;
  onRestored: (asset: MediaAssetDetail) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaAssetDetailDrawer({
  asset,
  folders,
  tags,
  onClose,
  onUpdated,
  onArchived,
  onRestored,
}: MediaAssetDetailDrawerProps) {
  const [form, setForm] = useState({
    altText: "",
    caption: "",
    description: "",
    copyright: "",
    photographer: "",
    folderId: "" as string | null,
    focusX: 0.5 as number | null,
    focusY: 0.5 as number | null,
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [usages, setUsages] = useState<MediaAssetUsageItem[]>([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"meta" | "focus" | "usage">("meta");
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (!asset) return;
    setForm({
      altText: asset.altText ?? "",
      caption: asset.caption ?? "",
      description: asset.description ?? "",
      copyright: asset.copyright ?? "",
      photographer: asset.photographer ?? "",
      folderId: asset.folderId ?? null,
      focusX: (asset as Record<string, unknown>).focusX != null ? (asset as Record<string, unknown>).focusX as number : 0.5,
      focusY: (asset as Record<string, unknown>).focusY != null ? (asset as Record<string, unknown>).focusY as number : 0.5,
    });
    setSelectedTagIds(asset.tags?.map((t) => t.id) ?? []);
    setSaveError(null);
    setActiveTab("meta");
  }, [asset?.id]);

  useEffect(() => {
    if (!asset || activeTab !== "usage") return;
    setUsagesLoading(true);
    fetch(`/api/media/${asset.id}/usage`)
      .then((r) => r.json())
      .then((d) => setUsages(d.usages ?? []))
      .catch(() => setUsages([]))
      .finally(() => setUsagesLoading(false));
  }, [asset?.id, activeTab]);

  async function handleSave() {
    if (!asset) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/media/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          altText: form.altText || null,
          caption: form.caption || null,
          description: form.description || null,
          copyright: form.copyright || null,
          photographer: form.photographer || null,
          folderId: form.folderId || null,
          tagIds: selectedTagIds,
          focusX: form.focusX ?? null,
          focusY: form.focusY ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error ?? "Fehler beim Speichern.");
      } else {
        onUpdated(data.asset as MediaAssetDetail);
      }
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!asset) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/media/${asset.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        onArchived(asset.id);
      }
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore() {
    if (!asset) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/media/${asset.id}/restore`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const fresh = await fetch(`/api/media/${asset.id}?archived=1`).then((r) => r.json()).catch(() => ({}));
        if (fresh?.asset) onRestored(fresh.asset as MediaAssetDetail);
      } else {
        setSaveError(data?.error ?? "Fehler beim Wiederherstellen.");
      }
    } finally {
      setRestoring(false);
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      const res = await fetch("/api/media/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.tag) {
        setSelectedTagIds((prev) => [...prev, data.tag.id]);
        setNewTagName("");
      }
    } finally {
      setCreatingTag(false);
    }
  }

  function copyUrl() {
    if (!asset) return;
    navigator.clipboard.writeText(asset.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  if (!asset) return null;

  const isArchived = asset.status === "ARCHIVED";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <span className="font-semibold text-sm text-[var(--foreground)]">Details</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="relative h-48 flex-shrink-0 bg-[var(--surface-2)]">
        {asset.type === "IMAGE" ? (
          <img
            src={asset.url}
            alt={asset.altText ?? asset.filename}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-12 w-12 text-[var(--muted)]" />
          </div>
        )}
        {isArchived && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">
              Archiviert
            </span>
          </div>
        )}
        {/* Type badge */}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          {asset.type === "IMAGE" ? <ImageIcon className="h-2.5 w-2.5" /> : <Film className="h-2.5 w-2.5" />}
          {asset.type === "IMAGE" ? "Bild" : "Video"}
        </span>
      </div>

      {/* File info */}
      <div className="border-b border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
        <p className="truncate font-medium text-[var(--foreground)]" title={asset.filename}>
          {asset.filename}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          <span>{formatBytes(asset.sizeBytes)}</span>
          {asset.width && asset.height && <span>{asset.width}×{asset.height}</span>}
          <span>{asset.mimeType}</span>
        </div>
        <p className="mt-0.5">
          Hochgeladen: {new Date(asset.createdAt).toLocaleDateString("de-CH")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {(["meta", "focus", "usage"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium transition ${
              activeTab === tab
                ? "border-b-2 border-[var(--tenant-primary)] text-[var(--tenant-primary)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab === "meta" ? (
              <span className="flex items-center justify-center gap-1">
                <Info className="h-3 w-3" /> Metadaten
              </span>
            ) : tab === "focus" ? (
              <span className="flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3" /> Fokus
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <Link2 className="h-3 w-3" /> Verwendung
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "meta" && (
          <div className="space-y-3 px-5 py-4">
            {saveError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {saveError}
              </div>
            )}

            {/* Alternativtext */}
            <Field label="Alternativtext" hint="Für Barrierefreiheit und SEO">
              <input
                type="text"
                value={form.altText}
                onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))}
                className="fca-input"
                placeholder="Beschreibung des Bildes"
              />
            </Field>

            {/* Bildunterschrift */}
            <Field label="Bildunterschrift">
              <input
                type="text"
                value={form.caption}
                onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                className="fca-input"
                placeholder="Optionale Bildunterschrift"
              />
            </Field>

            {/* Beschreibung */}
            <Field label="Beschreibung">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="fca-input resize-none"
                placeholder="Optionale Beschreibung"
              />
            </Field>

            {/* Urheberrecht */}
            <Field label="Urheberrecht">
              <input
                type="text"
                value={form.copyright}
                onChange={(e) => setForm((f) => ({ ...f, copyright: e.target.value }))}
                className="fca-input"
                placeholder="© 2025 Fotograf"
              />
            </Field>

            {/* Fotograf */}
            <Field label="Fotograf / Ersteller">
              <input
                type="text"
                value={form.photographer}
                onChange={(e) => setForm((f) => ({ ...f, photographer: e.target.value }))}
                className="fca-input"
                placeholder="Name des Fotografen"
              />
            </Field>

            {/* Ordner */}
            <Field label="Ordner">
              <select
                value={form.folderId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, folderId: e.target.value || null }))}
                className="fca-input"
              >
                <option value="">– Kein Ordner –</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                <Tag className="h-3 w-3" /> Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      selectedTagIds.includes(tag.id)
                        ? "bg-[var(--tenant-primary)] text-white"
                        : "bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              {/* Add new tag inline */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }}
                  placeholder="Neuer Tag…"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)]"
                />
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={creatingTag || !newTagName.trim()}
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)] disabled:opacity-50"
                >
                  {creatingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : "+"}
                </button>
              </div>
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || isArchived}
              className="fca-button-primary w-full"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Speichern…</>
              ) : (
                "Änderungen speichern"
              )}
            </button>
          </div>
        )}

        {activeTab === "focus" && asset?.type === "IMAGE" && (
          <div className="px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)] mb-1">Fokuspunkt</p>
              <p className="text-[11px] text-[var(--muted)] mb-4">
                Klicken Sie auf das Bild, um den Fokuspunkt zu setzen.
                Dieser Punkt bleibt beim Zuschneiden immer sichtbar.
              </p>
            </div>

            {/* Focus point picker */}
            {asset.url && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div
                  className="relative overflow-hidden rounded-lg border border-[var(--border)] cursor-crosshair"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    setForm((prev) => ({
                      ...prev,
                      focusX: Math.round(x * 100) / 100,
                      focusY: Math.round(y * 100) / 100,
                    }));
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={form.altText || asset.filename}
                    className="w-full object-cover"
                    style={{ maxHeight: 220 }}
                  />
                  {/* Focus point indicator */}
                  {form.focusX != null && form.focusY != null && (
                    <div
                      className="absolute h-6 w-6 -translate-x-3 -translate-y-3 pointer-events-none"
                      style={{
                        left: `${(form.focusX ?? 0.5) * 100}%`,
                        top: `${(form.focusY ?? 0.5) * 100}%`,
                      }}
                    >
                      <div className="absolute inset-0 rounded-full border-2 border-white shadow-md bg-[var(--accent)] opacity-80" />
                      <div className="absolute inset-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-center text-[10px] text-[var(--muted)]">
                  Fokuspunkt: {Math.round((form.focusX ?? 0.5) * 100)}% H / {Math.round((form.focusY ?? 0.5) * 100)}% V
                </p>
              </div>
            )}

            {/* Reset */}
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setForm((prev) => ({ ...prev, focusX: 0.5, focusY: 0.5 }))}
                className="fca-button-secondary text-xs">
                Fokus zentrieren
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="fca-button-primary text-xs">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Fokuspunkt speichern
              </button>
            </div>
          </div>
        )}

        {activeTab === "usage" && (
          <div className="px-5 py-4">
            <p className="mb-3 text-xs text-[var(--muted)]">
              Dieses Medium wird verwendet in:
            </p>
            {usagesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
              </div>
            ) : usages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-[var(--muted)]">
                <MapPin className="h-6 w-6 opacity-30" />
                <p className="text-xs">Wird derzeit nirgends verwendet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {usages.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{u.label}</p>
                      {u.fieldPath && (
                        <p className="text-[10px] text-[var(--muted)]">{u.fieldPath}</p>
                      )}
                    </div>
                    {u.href && (
                      <a
                        href={u.href}
                        className="rounded-lg border border-[var(--border)] px-2 py-1 text-[10px] hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)]"
                      >
                        Öffnen
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-3 space-y-2">
        {/* Copy URL */}
        <button
          type="button"
          onClick={copyUrl}
          className="fca-button-secondary w-full text-xs"
        >
          {copied ? (
            <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> URL kopiert</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> URL kopieren</>
          )}
        </button>

        {/* Download */}
        <a
          href={asset.url}
          download={asset.filename}
          target="_blank"
          rel="noopener noreferrer"
          className="fca-button-secondary flex w-full items-center justify-center gap-1.5 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          Herunterladen
        </a>

        {/* Archive / Restore */}
        {isArchived ? (
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring}
            className="fca-button-secondary w-full text-xs"
          >
            {restoring ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Wiederherstellen
          </button>
        ) : (
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiving}
            className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-50"
          >
            {archiving ? (
              <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="inline h-3.5 w-3.5" />
            )}{" "}
            Archivieren
          </button>
        )}
      </div>
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-[var(--foreground)]">{label}</label>
        {hint && <span className="text-[10px] text-[var(--muted)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
