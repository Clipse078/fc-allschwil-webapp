"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Settings2,
  RefreshCw,
  Plus,
  LayoutDashboard,
  Newspaper,
  FileText,
  Image,
  Calendar,
  Users,
  MessageSquare,
} from "lucide-react";
import HomepageBlockStatusBadge from "@/components/admin/homepage/HomepageBlockStatusBadge";
import HomepageBlockForm from "@/components/admin/homepage/HomepageBlockForm";
import type {
  HomepageBlockAdminItem,
  WebsiteBlockType,
} from "@/lib/homepage/types";
import { BLOCK_TYPE_LABEL, defaultConfigForType } from "@/lib/homepage/types";

// ── Block type icon ───────────────────────────────────────────────────────────

function BlockTypeIcon({ type }: { type: WebsiteBlockType }) {
  const cls = "h-4 w-4 shrink-0";
  switch (type) {
    case "HERO":             return <LayoutDashboard className={cls} />;
    case "RICH_TEXT":        return <FileText className={cls} />;
    case "NEWS":             return <Newspaper className={cls} />;
    case "UPCOMING_MATCHES": return <Calendar className={cls} />;
    case "SPONSORS":         return <Users className={cls} />;
    case "CTA":              return <MessageSquare className={cls} />;
    case "GALLERY":          return <Image className={cls} />;
    default:                 return <LayoutDashboard className={cls} />;
  }
}

// ── Add-block type picker ─────────────────────────────────────────────────────

const ALL_TYPES: WebsiteBlockType[] = [
  "HERO",
  "RICH_TEXT",
  "NEWS",
  "UPCOMING_MATCHES",
  "SPONSORS",
  "CTA",
  "GALLERY",
];

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  requiresReview: boolean;
};

export default function HomepageBlockManager({ requiresReview }: Props) {
  const [blocks, setBlocks] = useState<HomepageBlockAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<WebsiteBlockType>("HERO");
  const [addTitle, setAddTitle] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage-blocks");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setBlocks(data.blocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Reorder ────────────────────────────────────────────────────────────────

  async function move(index: number, dir: "up" | "down") {
    const newBlocks = [...blocks];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newBlocks.length) return;
    [newBlocks[index], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[index]];
    setBlocks(newBlocks);

    const orderedIds = newBlocks.map((b) => b.id);
    await fetch("/api/homepage-blocks/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
  }

  // ── Enable toggle ──────────────────────────────────────────────────────────

  async function toggleEnabled(id: string, currentEnabled: boolean) {
    setActionPending(id);
    try {
      const res = await fetch(`/api/homepage-blocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.block) {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === id
              ? { ...b, instance: b.instance ? { ...b.instance, enabled: !currentEnabled } : null }
              : b,
          ),
        );
      }
    } finally {
      setActionPending(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!window.confirm("Block wirklich löschen?")) return;
    setActionPending(id);
    try {
      const res = await fetch(`/api/homepage-blocks/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        if (editingId === id) setEditingId(null);
      }
    } finally {
      setActionPending(null);
    }
  }

  // ── Add block ──────────────────────────────────────────────────────────────

  async function handleAdd() {
    setAddPending(true);
    setError(null);
    try {
      const title = addTitle.trim() || `${BLOCK_TYPE_LABEL[addType]} Block`;
      const res = await fetch("/api/homepage-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addType,
          title,
          config: defaultConfigForType(addType),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? "Fehler beim Erstellen"); return; }
      setBlocks((prev) => [...prev, data.block]);
      setShowAddForm(false);
      setAddTitle("");
      setEditingId(data.block.id);
    } finally {
      setAddPending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="fca-button-secondary px-2.5"
          title="Aktualisieren"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}
          className="fca-button-primary flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Block hinzufügen
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 text-xs underline"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add block form */}
      {showAddForm && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">Neuen Block erstellen</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">
                Block-Typ
              </label>
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value as WebsiteBlockType)}
                className="fca-input"
              >
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BLOCK_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">
                Interner Titel
              </label>
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder={`${BLOCK_TYPE_LABEL[addType]} Block`}
                className="fca-input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={addPending}
              className="fca-button-primary flex items-center gap-1.5"
            >
              {addPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Erstellen
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="fca-button-secondary"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Block list */}
      {loading && blocks.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-[var(--muted)]">
          <LayoutDashboard className="h-10 w-10 opacity-20" />
          <p className="text-sm">Keine Homepage-Blöcke vorhanden.</p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="fca-button-primary flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Ersten Block erstellen
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]">
          {blocks.map((block, idx) => {
            const isEditing = editingId === block.id;
            const isEnabled = block.instance?.enabled ?? true;
            const isPending = actionPending === block.id;

            return (
              <div key={block.id} className="border-b border-[var(--border)] last:border-0">
                {/* Block row */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 transition ${
                    isEditing ? "bg-[var(--surface-2)]" : "bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(idx, "up")}
                      disabled={idx === 0 || isPending}
                      className="sce-icon-button disabled:opacity-30"
                      title="Nach oben"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, "down")}
                      disabled={idx === blocks.length - 1 || isPending}
                      className="sce-icon-button disabled:opacity-30"
                      title="Nach unten"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Enable toggle */}
                  <button
                    type="button"
                    onClick={() => toggleEnabled(block.id, isEnabled)}
                    disabled={isPending}
                    title={isEnabled ? "Deaktivieren" : "Aktivieren"}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      isEnabled ? "bg-[var(--tenant-primary,theme(colors.emerald.500))]" : "bg-[var(--border)]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        isEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>

                  {/* Type icon + labels */}
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    <span className="text-[var(--muted)]">
                      <BlockTypeIcon type={block.type} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {block.title}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {BLOCK_TYPE_LABEL[block.type]}
                        {!isEnabled && (
                          <span className="ml-1.5 text-amber-600">· Deaktiviert</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <HomepageBlockStatusBadge status={block.status} />

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : block.id)}
                      className={`sce-icon-button ${isEditing ? "text-[var(--tenant-primary,theme(colors.blue.600))]" : ""}`}
                      title="Konfigurieren"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(block.id)}
                      disabled={isPending}
                      className="sce-icon-button text-rose-500 hover:text-rose-700"
                      title="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <HomepageBlockForm
                    block={block}
                    requiresReview={requiresReview}
                    onSaved={(updated) => {
                      setBlocks((prev) =>
                        prev.map((b) => (b.id === updated.id ? updated : b)),
                      );
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {blocks.length > 0 && (
        <p className="text-[11px] text-[var(--muted)]">
          {blocks.length} Block{blocks.length !== 1 ? "s" : ""} · {blocks.filter(b => b.instance?.enabled).length} aktiv
        </p>
      )}
    </div>
  );
}
