"use client";

/**
 * SharedComponentPicker — Reusable component picker dialog (CMS V2 Slice 12).
 *
 * The single picker for all modules that embed reusable components:
 *   - Homepage Builder
 *   - Page Builder
 *   - News articles
 *   - Events
 *   - Sponsors
 *   - InfoBoard
 *   - Club Documents
 *   - Future Mobile content
 *
 * Usage:
 *   <SharedComponentPicker
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onSelect={(component) => handleSelect(component)}
 *     filterType="CTA"           // optional — pre-filter by type
 *   />
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search,
  X,
  CheckCircle2,
  Clock,
  MousePointerClick,
  Award,
  ContactRound,
  CircleHelp,
  Quote,
  BarChart3,
  Megaphone,
  FileText,
  ChevronDown,
  RefreshCw,
  LayoutTemplate,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  LayoutPanelLeft,
  Blocks,
  Library,
} from "lucide-react";
import type { ReusableComponentAdminItem } from "@/lib/reusable-components/types";
import {
  REUSABLE_COMPONENT_TYPES,
  BLOCK_SECTION_TYPE_LABELS,
  getTypeLabel,
} from "@/lib/reusable-components/component-types";
import { SECTION_PUBLISH_STATUS } from "@/lib/cms/section-publishing";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  // Inline component types
  CTA:            <MousePointerClick className="h-4 w-4" />,
  SPONSOR_BANNER: <Award className="h-4 w-4" />,
  CONTACT_CARD:   <ContactRound className="h-4 w-4" />,
  FAQ:            <CircleHelp className="h-4 w-4" />,
  QUOTE:          <Quote className="h-4 w-4" />,
  STATISTICS:     <BarChart3 className="h-4 w-4" />,
  ANNOUNCEMENT:   <Megaphone className="h-4 w-4" />,
  RICH_TEXT:      <FileText className="h-4 w-4" />,
  // Block section types (saved from Homepage / Page Builder)
  hero:                   <LayoutTemplate className="h-4 w-4" />,
  newsTeaser:             <Newspaper className="h-4 w-4" />,
  eventsTeaser:           <Calendar className="h-4 w-4" />,
  teamsTeaser:            <Users className="h-4 w-4" />,
  weekplanTeaser:         <CalendarDays className="h-4 w-4" />,
  callToAction:           <MousePointerClick className="h-4 w-4" />,
  sponsorsTeaser:         <Award className="h-4 w-4" />,
  splitContentCards:      <LayoutPanelLeft className="h-4 w-4" />,
  customContentPlaceholder: <Blocks className="h-4 w-4" />,
};

type SharedComponentPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (component: ReusableComponentAdminItem) => void;
  filterType?: string;
  title?: string;
  /** Label for the confirm button. Default: "Auswählen" */
  insertLabel?: string;
  /** When true, only shows published components. Default: false (show all) */
  publishedOnly?: boolean;
};

export default function SharedComponentPicker({
  open,
  onClose,
  onSelect,
  filterType,
  title = "Wiederverwendbaren Inhalt auswählen",
  insertLabel = "Als Kopie einfügen",
  publishedOnly = false,
}: SharedComponentPickerProps) {
  const [components, setComponents] = useState<ReusableComponentAdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(filterType ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, type: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (type) params.set("type", type);
      if (publishedOnly) params.set("publishStatus", "PUBLISHED");

      const res = await fetch(`/api/reusable-components?${params}`);
      if (!res.ok) throw new Error("Laden fehlgeschlagen.");
      const data = await res.json();
      setComponents(data.components ?? []);
    } catch {
      setError("Komponenten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [publishedOnly]);

  useEffect(() => {
    if (!open) return;
    load(search, typeFilter);
    // search is intentionally excluded here — handled by the debounced effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typeFilter, load]);

  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(search, typeFilter), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, typeFilter, open, load]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch("");
      setTypeFilter(filterType ?? "");
      setSelectedId(null);
    }
  }, [open, filterType]);

  function handleConfirm() {
    const comp = components.find((c) => c.id === selectedId);
    if (comp) {
      onSelect(comp);
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
            />
          </div>

          {!filterType && (
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-3 pr-7 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
              >
                <option value="">Alle Typen</option>
                <optgroup label="Komponenten">
                  {REUSABLE_COMPONENT_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Sektion-Vorlagen">
                  {Object.entries(BLOCK_SECTION_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted)]" />
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ minHeight: "200px" }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-[var(--muted)]" />
            </div>
          ) : error ? (
            <div className="px-2 py-3 text-sm text-red-600">{error}</div>
          ) : components.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <FileText className="h-8 w-8 text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">Keine Komponenten gefunden.</p>
              <a
                href="/dashboard/website/components"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--tenant-primary)] hover:underline"
              >
                <Library className="h-3 w-3" />
                Zur Bibliothek
              </a>
            </div>
          ) : (
            <ul className="space-y-1">
              {components.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                    className={`w-full flex items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                      selectedId === c.id
                        ? "ring-2 ring-[var(--tenant-primary)]"
                        : "hover:bg-[var(--surface-2)]"
                    }`}
                    style={
                      selectedId === c.id
                        ? { background: "var(--tenant-accent)" }
                        : {}
                    }
                  >
                    <span
                      className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "var(--tenant-accent)", color: "var(--tenant-primary)" }}
                    >
                      {TYPE_ICONS[c.type] ?? <FileText className="h-4 w-4" />}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--foreground)] truncate">
                          {c.title}
                        </span>
                        {c.publishStatus === SECTION_PUBLISH_STATUS.PUBLISHED ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <Clock className="h-2.5 w-2.5" />
                            Entwurf
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px]">
                          {TYPE_ICONS[c.type]}
                          {getTypeLabel(c.type)}
                        </span>
                        <span>/{c.slug}</span>
                      </div>

                      {c.description && (
                        <p className="mt-0.5 text-xs text-[var(--text-2)] line-clamp-1">
                          {c.description}
                        </p>
                      )}
                    </div>

                    {selectedId === c.id && (
                      <CheckCircle2
                        className="h-4 w-4 flex-shrink-0 mt-2"
                        style={{ color: "var(--tenant-primary)" }}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <a
            href="/dashboard/website/components"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--tenant-primary)] hover:underline"
          >
            <Library className="h-3.5 w-3.5" />
            Bibliothek verwalten
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            >
              Abbrechen
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedId}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "var(--tenant-primary)" }}
            >
              {insertLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
