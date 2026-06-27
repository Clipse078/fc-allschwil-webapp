"use client";

/**
 * ReusableComponentsLibrary
 *
 * Premium admin UI for the Reusable Content Component Library (CMS V2 Slice 12).
 *
 * Features:
 * - Search + type filter + status filter
 * - Usage count badges
 * - Publishing status badges
 * - Last modified + last editor
 * - Preview panel
 * - Archive / duplicate / version history
 * - Create new component
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  RefreshCw,
  MoreHorizontal,
  Copy,
  Archive,
  History,
  Eye,
  MousePointerClick,
  Award,
  ContactRound,
  CircleHelp,
  Quote,
  BarChart3,
  Megaphone,
  FileText,
  Filter,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  Clock,
  Pencil,
} from "lucide-react";
import type { ReusableComponentAdminItem } from "@/lib/reusable-components/types";
import {
  REUSABLE_COMPONENT_TYPES,
  COMPONENT_TYPE_LABELS,
} from "@/lib/reusable-components/component-types";
import { SECTION_PUBLISH_STATUS, SECTION_APPROVAL_STATUS_LABELS } from "@/lib/cms/section-publishing";
import { CMS_ROUTES } from "@/lib/cms/routes";

// ── Icon map ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  CTA:            <MousePointerClick className="h-4 w-4" />,
  SPONSOR_BANNER: <Award className="h-4 w-4" />,
  CONTACT_CARD:   <ContactRound className="h-4 w-4" />,
  FAQ:            <CircleHelp className="h-4 w-4" />,
  QUOTE:          <Quote className="h-4 w-4" />,
  STATISTICS:     <BarChart3 className="h-4 w-4" />,
  ANNOUNCEMENT:   <Megaphone className="h-4 w-4" />,
  RICH_TEXT:      <FileText className="h-4 w-4" />,
};

// ── Status badge ─────────────────────────────────────────────────────────────

function PublishBadge({ status }: { status: string }) {
  if (status === SECTION_PUBLISH_STATUS.PUBLISHED) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle2 className="h-3 w-3" />
        Veröffentlicht
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
      <Clock className="h-3 w-3" />
      Entwurf
    </span>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === "NOT_REQUIRED") return null;
  const label = SECTION_APPROVAL_STATUS_LABELS[status as keyof typeof SECTION_APPROVAL_STATUS_LABELS] ?? status;
  const colours: Record<string, string> = {
    DRAFT:             "bg-gray-100 text-gray-600",
    IN_REVIEW:         "bg-blue-100 text-blue-700",
    APPROVED:          "bg-green-100 text-green-700",
    CHANGES_REQUESTED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colours[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  return new Date(date).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReusableComponentsLibrary() {
  const router = useRouter();

  const [components, setComponents] = useState<ReusableComponentAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [previewComponent, setPreviewComponent] = useState<ReusableComponentAdminItem | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (q: string, type: string, status: string, archived: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (type) params.set("type", type);
      if (status) params.set("publishStatus", status);
      if (archived) params.set("includeArchived", "true");

      const res = await fetch(`/api/reusable-components?${params}`);
      if (!res.ok) throw new Error("Laden fehlgeschlagen.");
      const data = await res.json();
      setComponents(data.components ?? []);

      // Load usage counts
      const ids: string[] = (data.components ?? []).map((c: ReusableComponentAdminItem) => c.id);
      if (ids.length > 0) {
        await loadUsageCounts(ids);
      }
    } catch {
      setError("Komponenten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadUsageCounts(ids: string[]) {
    const counts: Record<string, number> = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/reusable-components/${id}/usage`);
          if (res.ok) {
            const data = await res.json();
            counts[id] = data.meta?.total ?? 0;
          }
        } catch {
          // best-effort
        }
      }),
    );
    setUsageCounts(counts);
  }

  useEffect(() => {
    load(search, typeFilter, statusFilter, includeArchived);
    // search is intentionally excluded here — handled by the debounced effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, includeArchived, load]);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      load(search, typeFilter, statusFilter, includeArchived);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, typeFilter, statusFilter, includeArchived, load]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleDuplicate(id: string) {
    setOpenMenuId(null);
    const res = await fetch(`/api/reusable-components/${id}/duplicate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/website/components/${data.component.id}/edit`);
    }
  }

  async function handleArchive(id: string) {
    setOpenMenuId(null);
    if (!confirm("Komponente archivieren? Sie ist danach nicht mehr öffentlich sichtbar.")) return;
    const res = await fetch(`/api/reusable-components/${id}`, { method: "DELETE" });
    if (res.ok) {
      load(search, typeFilter, statusFilter, includeArchived);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-lg">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
            />
          </div>
          <button
            onClick={() => load(search, typeFilter, statusFilter, includeArchived)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Type filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
            >
              <option value="">Alle Typen</option>
              {REUSABLE_COMPONENT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
            >
              <option value="">Alle Status</option>
              <option value="DRAFT">Entwurf</option>
              <option value="PUBLISHED">Veröffentlicht</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
          </div>

          {/* Archived toggle */}
          <button
            onClick={() => setIncludeArchived((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              includeArchived
                ? "border-[var(--tenant-primary)] bg-[var(--tenant-accent)] text-[var(--tenant-primary)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Archiviert
          </button>

          {/* New button */}
          <a
            href={CMS_ROUTES.componentsNew}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ background: "var(--tenant-primary)" }}
          >
            <Plus className="h-4 w-4" />
            Neue Komponente
          </a>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : components.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "var(--tenant-accent)", color: "var(--tenant-primary)" }}
            >
              <FileText className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Keine Komponenten gefunden
            </p>
            <p className="text-sm text-[var(--muted)]">
              Erstelle die erste wiederverwendbare Komponente.
            </p>
            <a
              href={CMS_ROUTES.componentsNew}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white"
              style={{ background: "var(--tenant-primary)" }}
            >
              <Plus className="h-4 w-4" />
              Neue Komponente
            </a>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Komponente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Typ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Verwendungen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Zuletzt geändert</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {components.map((c) => (
                <tr
                  key={c.id}
                  className="group hover:bg-[var(--surface-2)] transition-colors"
                >
                  {/* Title + slug */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-[var(--foreground)]">{c.title}</span>
                      <span className="text-xs text-[var(--muted)]">/{c.slug}</span>
                      {c.description && (
                        <span className="text-xs text-[var(--text-2)] line-clamp-1">{c.description}</span>
                      )}
                      {c.archivedAt && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <Archive className="h-3 w-3" /> Archiviert
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium text-[var(--foreground)]">
                      <span className="text-[var(--tenant-primary)]">{TYPE_ICONS[c.type]}</span>
                      {COMPONENT_TYPE_LABELS[c.type] ?? c.type}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <PublishBadge status={c.publishStatus} />
                      <ApprovalBadge status={c.approvalStatus} />
                    </div>
                  </td>

                  {/* Usage count */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--foreground)]">
                      {usageCounts[c.id] ?? 0}×
                    </span>
                  </td>

                  {/* Last modified */}
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    <div className="flex flex-col gap-0.5">
                      <span>{relativeTime(c.updatedAt)}</span>
                      {c.createdByUser && (
                        <span className="text-[var(--text-2)]">
                          {c.createdByUser.firstName} {c.createdByUser.lastName}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <a
                        href={`/dashboard/website/components/${c.id}/edit`}
                        className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </a>

                      {/* Preview */}
                      <button
                        onClick={() => setPreviewComponent(c)}
                        className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
                        title="Vorschau"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {/* More menu */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openMenuId === c.id && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                            <button
                              onClick={() => handleDuplicate(c.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                            >
                              <Copy className="h-4 w-4 text-[var(--muted)]" />
                              Duplizieren
                            </button>
                            <a
                              href={`/dashboard/website/components/${c.id}/revisions`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <History className="h-4 w-4 text-[var(--muted)]" />
                              Versionshistorie
                            </a>
                            <div className="border-t border-[var(--border)]" />
                            {!c.archivedAt ? (
                              <button
                                onClick={() => handleArchive(c.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Archive className="h-4 w-4" />
                                Archivieren
                              </button>
                            ) : (
                              <span className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted)] cursor-default">
                                <Archive className="h-4 w-4" />
                                Bereits archiviert
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Preview Panel ─────────────────────────────────────────────────────── */}
      {previewComponent && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setPreviewComponent(null)}>
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--tenant-primary)]" style={{ background: "var(--tenant-accent)" }}>
                  {TYPE_ICONS[previewComponent.type]}
                </span>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{previewComponent.title}</p>
                  <p className="text-xs text-[var(--muted)]">{COMPONENT_TYPE_LABELS[previewComponent.type] ?? previewComponent.type} · /{previewComponent.slug}</p>
                </div>
              </div>
              <button onClick={() => setPreviewComponent(null)} className="rounded-lg p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>

            {previewComponent.description && (
              <p className="text-sm text-[var(--text-2)]">{previewComponent.description}</p>
            )}

            <div className="flex items-center gap-2">
              <PublishBadge status={previewComponent.publishStatus} />
              <ApprovalBadge status={previewComponent.approvalStatus} />
            </div>

            {/* Config preview */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)] font-mono overflow-auto max-h-40">
              <pre>{JSON.stringify(previewComponent.config, null, 2)}</pre>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPreviewComponent(null)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]">
                Schliessen
              </button>
              <a
                href={`/dashboard/website/components/${previewComponent.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ background: "var(--tenant-primary)" }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Close menu on outside click ──────────────────────────────────────── */}
      {openMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}
