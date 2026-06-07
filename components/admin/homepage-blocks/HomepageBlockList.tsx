"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PenLine,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import HomepageBlockStatusBadge from "@/components/admin/homepage-blocks/HomepageBlockStatusBadge";
import type { BlockStatus, HomepageBlockAdminItem } from "@/lib/homepage-blocks/admin-queries";

type FilterStatus = "ALL" | BlockStatus;

function formatDate(d: Date | null): string {
  if (!d) return "–";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

export default function HomepageBlockList() {
  const [blocks, setBlocks] = useState<HomepageBlockAdminItem[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [reorderPending, setReorderPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      const res = await fetch(`/api/homepage-blocks?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setBlocks(data.blocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePublish(id: string, currentStatus: BlockStatus) {
    setActionPending(id);
    try {
      const action = currentStatus === "PUBLISHED" ? "?action=unpublish" : "";
      const res = await fetch(`/api/homepage-blocks/${id}/publish${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, status: data.block.status, publishedAt: data.block.publishedAt } : b,
        ),
      );
    } finally {
      setActionPending(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Block wirklich löschen?")) return;
    setActionPending(id);
    try {
      const res = await fetch(`/api/homepage-blocks/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
      }
    } finally {
      setActionPending(null);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]];
    setBlocks(newBlocks);

    setReorderPending(true);
    try {
      const res = await fetch("/api/homepage-blocks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: newBlocks.map((b) => b.id) }),
      });
      if (!res.ok) {
        // Revert on error
        setBlocks(blocks);
        alert("Fehler beim Speichern der Reihenfolge.");
      }
    } finally {
      setReorderPending(false);
    }
  }

  const filters: { label: string; value: FilterStatus }[] = [
    { label: "Alle", value: "ALL" },
    { label: "Entwurf", value: "DRAFT" },
    { label: "In Prüfung", value: "IN_REVIEW" },
    { label: "Geplant", value: "SCHEDULED" },
    { label: "Veröffentlicht", value: "PUBLISHED" },
    { label: "Archiviert", value: "ARCHIVED" },
  ];

  const displayedBlocks = filter === "ALL" ? blocks : blocks.filter((b) => b.status === filter);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-medium">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 transition ${
                filter === f.value
                  ? "bg-[var(--surface)] shadow-sm text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/website/homepage/preview"
            className="fca-button-secondary text-sm inline-flex items-center gap-1.5"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye className="h-3.5 w-3.5" />
            Vorschau
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="fca-button-secondary px-2.5"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link href="/dashboard/website/homepage/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neuer Block
          </Link>
        </div>
      </div>

      {/* Info about reorder */}
      {filter === "ALL" && blocks.length > 1 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-[11px] text-[var(--muted)]">
          <GripVertical className="inline h-3 w-3 mr-1" />
          Reihenfolge mit den Pfeiltasten anpassen. Änderungen werden sofort gespeichert.
          {reorderPending && " Speichert…"}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading && blocks.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : displayedBlocks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[var(--muted)]">
          <p className="text-sm">Keine Blöcke vorhanden.</p>
          <Link href="/dashboard/website/homepage/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Ersten Block erstellen
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th className="w-8 px-2 py-2.5" />
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Block
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Typ
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Veröffentlicht
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {displayedBlocks.map((blk, idx) => (
                <tr
                  key={blk.id}
                  className="bg-[var(--surface)] transition hover:bg-[var(--surface-2)]"
                >
                  {/* Order indicator */}
                  <td className="px-2 py-3 text-center text-[10px] text-[var(--muted)]">
                    {filter === "ALL" ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMove(blk.id, "up")}
                          disabled={idx === 0 || reorderPending}
                          className="rounded p-0.5 hover:bg-[var(--border)] disabled:opacity-30"
                          title="Nach oben"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <span className="font-mono">{blk.sortOrder + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleMove(blk.id, "down")}
                          disabled={idx === displayedBlocks.length - 1 || reorderPending}
                          className="rounded p-0.5 hover:bg-[var(--border)] disabled:opacity-30"
                          title="Nach unten"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      blk.sortOrder + 1
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {blk.heroMedia ? (
                        <img
                          src={blk.heroMedia.url}
                          alt={blk.heroMedia.altText ?? blk.title}
                          className="h-10 w-16 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-16 flex-shrink-0 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]" />
                      )}
                      <div>
                        <p className="font-medium text-[var(--foreground)] line-clamp-1">
                          {blk.title}
                        </p>
                        {(blk.data as { headline?: string }).headline && (
                          <p className="text-[11px] text-[var(--muted)] line-clamp-1">
                            {(blk.data as { headline?: string }).headline}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--foreground)]">
                      {blk.type}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <HomepageBlockStatusBadge status={blk.status} />
                  </td>

                  <td className="px-4 py-3 text-[11px] text-[var(--muted)]">
                    {formatDate(blk.publishedAt)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dashboard/website/homepage/${blk.id}/edit`}
                        className="sce-icon-button"
                        title="Bearbeiten"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </Link>
                      {blk.status !== "IN_REVIEW" && (
                        <button
                          type="button"
                          onClick={() => handlePublish(blk.id, blk.status)}
                          disabled={actionPending === blk.id}
                          className="sce-icon-button"
                          title={blk.status === "PUBLISHED" ? "Depublizieren" : "Veröffentlichen"}
                        >
                          {blk.status === "PUBLISHED" ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(blk.id)}
                        disabled={actionPending === blk.id}
                        className="sce-icon-button text-rose-500 hover:text-rose-700"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && blocks.length > 0 && (
        <p className="text-[11px] text-[var(--muted)]">
          {displayedBlocks.length} von {blocks.length} Blöcken angezeigt
        </p>
      )}
    </div>
  );
}
