"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Globe,
  FileText,
  Link,
} from "lucide-react";
import NavItemForm from "@/components/admin/navigation/NavItemForm";
import type { NavItemAdminRow, NavGroupAdmin } from "@/lib/navigation/admin-queries";

type PageOption = { id: string; slug: string; title: string };

type Props = {
  navKey: "main" | "footer";
  title: string;
  description: string;
};

function ItemTypeIcon({ type }: { type: string }) {
  if (type === "PAGE") return <FileText className="h-3.5 w-3.5 text-[var(--muted)]" />;
  if (type === "EXTERNAL_URL") return <Globe className="h-3.5 w-3.5 text-[var(--muted)]" />;
  return <Link className="h-3.5 w-3.5 text-[var(--muted)]" />;
}

function itemTypeLabel(type: string): string {
  if (type === "PAGE") return "Seite";
  if (type === "EXTERNAL_URL") return "Extern";
  return "Intern";
}

export default function WebsiteNavigationGroupCard({ navKey, title, description }: Props) {
  const [group, setGroup] = useState<NavGroupAdmin | null>(null);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [navRes, pagesRes] = await Promise.all([
        fetch("/api/website-navigation"),
        fetch("/api/website-pages?status=PUBLISHED&limit=100"),
      ]);
      const navData = await navRes.json().catch(() => ({}));
      if (!navRes.ok) throw new Error(navData?.error ?? "Ladefehler");
      setGroup(navData.navigation[navKey]);

      const pagesData = await pagesRes.json().catch(() => ({}));
      setPages(
        (pagesData.pages ?? []).map((p: { id: string; slug: string; title: string }) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [navKey]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleVisible(item: NavItemAdminRow) {
    setActionPending(item.id);
    try {
      const res = await fetch(`/api/website-navigation/${navKey}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: !item.isVisible }),
      });
      if (res.ok) {
        setGroup((prev) => prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === item.id ? { ...i, isVisible: !item.isVisible } : i,
              ),
            }
          : prev,
        );
      }
    } finally {
      setActionPending(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Navigationselement wirklich löschen?")) return;
    setActionPending(id);
    try {
      const res = await fetch(`/api/website-navigation/${navKey}/items/${id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        setGroup((prev) =>
          prev ? { ...prev, items: prev.items.filter((i) => i.id !== id) } : prev,
        );
      }
    } finally {
      setActionPending(null);
    }
  }

  async function handleMoveItem(id: string, direction: "up" | "down") {
    if (!group) return;
    const items = [...group.items];
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;

    // Swap in local state immediately
    const swapped = [...items];
    [swapped[idx], swapped[newIdx]] = [swapped[newIdx], swapped[idx]];
    setGroup({ ...group, items: swapped });

    // Persist via reorder API
    setActionPending(id);
    try {
      await fetch(`/api/website-navigation/${navKey}/items/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: swapped.map((i) => i.id) }),
      });
    } finally {
      setActionPending(null);
    }
  }

  const items = group?.items ?? [];

  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="fca-button-secondary px-2"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            className="fca-button-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Element hinzufügen
          </button>
        </div>
      </div>

      <div className="sce-detail-section-body space-y-3">
        {error && (
          <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : items.length === 0 && !showAddForm ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[var(--muted)]">
            <p className="text-xs">Keine Navigationselemente vorhanden.</p>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="fca-button-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Erstes Element hinzufügen
            </button>
          </div>
        ) : (
          <>
            {/* Item list */}
            {items.length > 0 && (
              <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <tr>
                      <th className="w-8 px-2" />
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Label</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Typ</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] hidden sm:table-cell">Ziel</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Status</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="bg-[var(--surface)] hover:bg-[var(--surface-2)] transition"
                      >
                        {/* Sort order */}
                        <td className="px-1 py-1">
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => handleMoveItem(item.id, "up")}
                              disabled={idx === 0 || actionPending === item.id}
                              className="sce-icon-button disabled:opacity-30"
                              title="Nach oben"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(item.id, "down")}
                              disabled={idx === items.length - 1 || actionPending === item.id}
                              className="sce-icon-button disabled:opacity-30"
                              title="Nach unten"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {/* Label */}
                        <td className="px-3 py-2">
                          <span className={`font-medium text-[var(--foreground)] ${!item.isVisible ? "opacity-40 line-through" : ""}`}>
                            {item.label}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                            <ItemTypeIcon type={item.itemType} />
                            {itemTypeLabel(item.itemType)}
                          </span>
                        </td>

                        {/* Target URL / page */}
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <span className="text-[11px] text-[var(--muted)] font-mono truncate max-w-[180px] block">
                            {item.itemType === "PAGE"
                              ? item.page
                                ? `/${item.page.slug}` + (item.page.status !== "PUBLISHED" ? " ⚠️" : "")
                                : "–"
                              : item.url ?? "–"}
                          </span>
                        </td>

                        {/* Visibility */}
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            item.isVisible
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]"
                          }`}>
                            {item.isVisible ? "Sichtbar" : "Versteckt"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id);
                                setShowAddForm(false);
                              }}
                              className="sce-icon-button"
                              title="Bearbeiten"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleVisible(item)}
                              disabled={actionPending === item.id}
                              className="sce-icon-button"
                              title={item.isVisible ? "Verstecken" : "Anzeigen"}
                            >
                              {item.isVisible
                                ? <EyeOff className="h-3.5 w-3.5" />
                                : <Eye className="h-3.5 w-3.5" />
                              }
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              disabled={actionPending === item.id}
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

            {/* Edit inline forms */}
            {editingId && (
              <NavItemForm
                navKey={navKey}
                pages={pages}
                onSaved={() => { setEditingId(null); load(); }}
                onCancel={() => setEditingId(null)}
                initial={(() => {
                  const item = items.find((i) => i.id === editingId);
                  if (!item) return undefined;
                  return {
                    id: item.id,
                    label: item.label,
                    itemType: item.itemType,
                    url: item.url,
                    pageId: item.pageId,
                    isVisible: item.isVisible,
                    opensInNewTab: item.opensInNewTab,
                  };
                })()}
              />
            )}
          </>
        )}

        {/* Add form */}
        {showAddForm && (
          <NavItemForm
            navKey={navKey}
            pages={pages}
            onSaved={() => { setShowAddForm(false); load(); }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  );
}
