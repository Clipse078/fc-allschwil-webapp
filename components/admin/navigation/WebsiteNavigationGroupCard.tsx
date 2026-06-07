"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  FolderOpen,
  CornerDownRight,
} from "lucide-react";
import NavItemForm from "@/components/admin/navigation/NavItemForm";
import type { NavItemAdminRow, NavGroupAdmin } from "@/lib/navigation/admin-queries";

type PageOption = { id: string; slug: string; title: string };

type Props = {
  navKey: "main" | "footer";
  title: string;
  description: string;
};

type ItemWithChildren = NavItemAdminRow & { children: NavItemAdminRow[] };

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

function resolveTarget(item: NavItemAdminRow): string {
  if (item.itemType === "PAGE") {
    if (!item.page) return "–";
    const slug = `/${item.page.slug}`;
    return item.page.status !== "PUBLISHED" ? `${slug} ⚠️` : slug;
  }
  return item.url ?? "–";
}

/** Flatten flat item list into parent→children structure */
function buildHierarchy(items: NavItemAdminRow[]): ItemWithChildren[] {
  const topLevel = items.filter((i) => i.parentId === null);
  return topLevel.map((parent) => ({
    ...parent,
    children: items
      .filter((i) => i.parentId === parent.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.valueOf() - b.createdAt.valueOf()),
  }));
}

type EditTarget =
  | { kind: "parent"; id: string }
  | { kind: "child"; parentId: string; id: string };

export default function WebsiteNavigationGroupCard({ navKey, title, description }: Props) {
  const [group, setGroup] = useState<NavGroupAdmin | null>(null);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [showAddTopForm, setShowAddTopForm] = useState(false);
  const [addingChildForParentId, setAddingChildForParentId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

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

  // ── Optimistic visibility toggle ─────────────────────────────────────────

  async function handleToggleVisible(item: NavItemAdminRow) {
    setActionPending(item.id);
    try {
      const res = await fetch(`/api/website-navigation/${navKey}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: !item.isVisible }),
      });
      if (res.ok) {
        setGroup((prev) =>
          prev
            ? { ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, isVisible: !item.isVisible } : i) }
            : prev,
        );
      }
    } finally {
      setActionPending(null);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Navigationselement wirklich löschen?")) return;
    setActionPending(id);
    try {
      const res = await fetch(`/api/website-navigation/${navKey}/items/${id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        setGroup((prev) =>
          prev ? { ...prev, items: prev.items.filter((i) => i.id !== id && i.parentId !== id) } : prev,
        );
      }
    } finally {
      setActionPending(null);
    }
  }

  // ── Reorder top-level items ───────────────────────────────────────────────

  async function handleMoveTopLevel(id: string, direction: "up" | "down") {
    if (!group) return;
    const topLevel = group.items.filter((i) => i.parentId === null);
    const idx = topLevel.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= topLevel.length) return;

    const swapped = [...topLevel];
    [swapped[idx], swapped[newIdx]] = [swapped[newIdx], swapped[idx]];

    const children = group.items.filter((i) => i.parentId !== null);
    setGroup({ ...group, items: [...swapped, ...children] });

    setActionPending(id);
    try {
      await fetch(`/api/website-navigation/${navKey}/items/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: swapped.map((i) => i.id), parentId: null }),
      });
    } finally {
      setActionPending(null);
    }
  }

  // ── Reorder children of a specific parent ────────────────────────────────

  async function handleMoveChild(parentId: string, id: string, direction: "up" | "down") {
    if (!group) return;
    const siblings = group.items.filter((i) => i.parentId === parentId);
    const idx = siblings.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= siblings.length) return;

    const swapped = [...siblings];
    [swapped[idx], swapped[newIdx]] = [swapped[newIdx], swapped[idx]];

    const others = group.items.filter((i) => i.parentId !== parentId);
    setGroup({ ...group, items: [...others, ...swapped] });

    setActionPending(id);
    try {
      await fetch(`/api/website-navigation/${navKey}/items/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: swapped.map((i) => i.id), parentId }),
      });
    } finally {
      setActionPending(null);
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const rawItems = group?.items ?? [];
  const hierarchy = buildHierarchy(rawItems);

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderItemActions(
    item: NavItemAdminRow,
    onEdit: () => void,
  ) {
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onEdit}
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
            : <Eye className="h-3.5 w-3.5" />}
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
    );
  }

  const isEditing = (id: string) =>
    editTarget?.kind === "parent"
      ? editTarget.id === id
      : editTarget?.id === id;

  function startEditParent(id: string) {
    setEditTarget({ kind: "parent", id });
    setShowAddTopForm(false);
    setAddingChildForParentId(null);
  }

  function startEditChild(parentId: string, id: string) {
    setEditTarget({ kind: "child", parentId, id });
    setShowAddTopForm(false);
    setAddingChildForParentId(null);
  }

  function cancelEdit() {
    setEditTarget(null);
  }

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
            onClick={() => { setShowAddTopForm(true); setEditTarget(null); setAddingChildForParentId(null); }}
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

        {loading && rawItems.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : hierarchy.length === 0 && !showAddTopForm ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[var(--muted)]">
            <p className="text-xs">Keine Navigationselemente vorhanden.</p>
            <button
              type="button"
              onClick={() => setShowAddTopForm(true)}
              className="fca-button-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Erstes Element hinzufügen
            </button>
          </div>
        ) : (
          <>
            {/* Hierarchical item list */}
            {hierarchy.length > 0 && (
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
                    {hierarchy.map((parent, parentIdx) => (
                      <React.Fragment key={parent.id}>
                        {/* ── Parent row ───────────────────────────────── */}
                        <tr
                          className="bg-[var(--surface)] hover:bg-[var(--surface-2)] transition"
                        >
                          {/* Sort order */}
                          <td className="px-1 py-1">
                            <div className="flex flex-col items-center">
                              <button
                                type="button"
                                onClick={() => handleMoveTopLevel(parent.id, "up")}
                                disabled={parentIdx === 0 || actionPending === parent.id}
                                className="sce-icon-button disabled:opacity-30"
                                title="Nach oben"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveTopLevel(parent.id, "down")}
                                disabled={parentIdx === hierarchy.length - 1 || actionPending === parent.id}
                                className="sce-icon-button disabled:opacity-30"
                                title="Nach unten"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </div>
                          </td>

                          {/* Label */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {parent.children.length > 0 && (
                                <FolderOpen className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
                              )}
                              <span className={`font-medium text-[var(--foreground)] ${!parent.isVisible ? "opacity-40 line-through" : ""}`}>
                                {parent.label}
                              </span>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                              {parent.url === null && parent.itemType !== "PAGE"
                                ? <FolderOpen className="h-3.5 w-3.5 text-[var(--muted)]" />
                                : <ItemTypeIcon type={parent.itemType} />}
                              {parent.url === null && parent.itemType !== "PAGE"
                                ? "Gruppe"
                                : itemTypeLabel(parent.itemType)}
                            </span>
                          </td>

                          {/* Target */}
                          <td className="px-3 py-2 hidden sm:table-cell">
                            <span className="text-[11px] text-[var(--muted)] font-mono truncate max-w-[180px] block">
                              {parent.url === null && parent.itemType !== "PAGE" ? "–" : resolveTarget(parent)}
                            </span>
                          </td>

                          {/* Visibility */}
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              parent.isVisible
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]"
                            }`}>
                              {parent.isVisible ? "Sichtbar" : "Versteckt"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {renderItemActions(parent, () => startEditParent(parent.id))}
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingChildForParentId(parent.id);
                                  setShowAddTopForm(false);
                                  setEditTarget(null);
                                }}
                                className="sce-icon-button text-blue-600 hover:text-blue-800"
                                title="Unterelement hinzufügen"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── Inline edit form for parent ───────────────── */}
                        {isEditing(parent.id) && editTarget?.kind === "parent" && (
                          <tr key={`edit-parent-${parent.id}`} className="bg-[var(--surface-2)]">
                            <td colSpan={6} className="px-4 py-3">
                              <NavItemForm
                                navKey={navKey}
                                pages={pages}
                                onSaved={() => { cancelEdit(); load(); }}
                                onCancel={cancelEdit}
                                initial={{
                                  id: parent.id,
                                  label: parent.label,
                                  itemType: parent.itemType,
                                  url: parent.url,
                                  pageId: parent.pageId,
                                  isVisible: parent.isVisible,
                                  opensInNewTab: parent.opensInNewTab,
                                  isGroupingOnly: parent.url === null && parent.itemType === "CUSTOM_URL",
                                }}
                              />
                            </td>
                          </tr>
                        )}

                        {/* ── Children rows ─────────────────────────────── */}
                        {parent.children.map((child, childIdx) => (
                          <React.Fragment key={child.id}>
                            <tr
                              className="bg-[var(--surface)] hover:bg-[var(--surface-2)] transition"
                            >
                              {/* Sort order (children) */}
                              <td className="px-1 py-1">
                                <div className="flex flex-col items-center pl-4">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveChild(parent.id, child.id, "up")}
                                    disabled={childIdx === 0 || actionPending === child.id}
                                    className="sce-icon-button disabled:opacity-30"
                                    title="Nach oben"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveChild(parent.id, child.id, "down")}
                                    disabled={childIdx === parent.children.length - 1 || actionPending === child.id}
                                    className="sce-icon-button disabled:opacity-30"
                                    title="Nach unten"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Label (indented) */}
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5 pl-5">
                                  <CornerDownRight className="h-3 w-3 text-[var(--muted)] shrink-0" />
                                  <span className={`text-[var(--foreground)] ${!child.isVisible ? "opacity-40 line-through" : ""}`}>
                                    {child.label}
                                  </span>
                                </div>
                              </td>

                              {/* Type */}
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                                  <ItemTypeIcon type={child.itemType} />
                                  {itemTypeLabel(child.itemType)}
                                </span>
                              </td>

                              {/* Target */}
                              <td className="px-3 py-2 hidden sm:table-cell">
                                <span className="text-[11px] text-[var(--muted)] font-mono truncate max-w-[180px] block">
                                  {resolveTarget(child)}
                                </span>
                              </td>

                              {/* Visibility */}
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  child.isVisible
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]"
                                }`}>
                                  {child.isVisible ? "Sichtbar" : "Versteckt"}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="px-3 py-2">
                                {renderItemActions(child, () => startEditChild(parent.id, child.id))}
                              </td>
                            </tr>

                            {/* ── Inline edit form for child ──────────────── */}
                            {isEditing(child.id) && editTarget?.kind === "child" && editTarget.parentId === parent.id && (
                              <tr className="bg-[var(--surface-2)]">
                                <td colSpan={6} className="px-4 py-3 pl-10">
                                  <NavItemForm
                                    navKey={navKey}
                                    pages={pages}
                                    parentId={parent.id}
                                    onSaved={() => { cancelEdit(); load(); }}
                                    onCancel={cancelEdit}
                                    initial={{
                                      id: child.id,
                                      label: child.label,
                                      itemType: child.itemType,
                                      url: child.url,
                                      pageId: child.pageId,
                                      isVisible: child.isVisible,
                                      opensInNewTab: child.opensInNewTab,
                                      isGroupingOnly: false,
                                    }}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}

                        {/* ── Add child form ────────────────────────────── */}
                        {addingChildForParentId === parent.id && (
                          <tr className="bg-[var(--surface-2)]">
                            <td colSpan={6} className="px-4 py-3 pl-10">
                              <div className="flex items-center gap-1.5 mb-2 text-[11px] text-[var(--muted)]">
                                <CornerDownRight className="h-3.5 w-3.5" />
                                Unterelement zu <strong className="text-[var(--foreground)]">{parent.label}</strong> hinzufügen
                              </div>
                              <NavItemForm
                                navKey={navKey}
                                pages={pages}
                                parentId={parent.id}
                                onSaved={() => { setAddingChildForParentId(null); load(); }}
                                onCancel={() => setAddingChildForParentId(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Add top-level form */}
        {showAddTopForm && (
          <NavItemForm
            navKey={navKey}
            pages={pages}
            onSaved={() => { setShowAddTopForm(false); load(); }}
            onCancel={() => setShowAddTopForm(false)}
            allowGroupingOnly
          />
        )}
      </div>
    </div>
  );
}
