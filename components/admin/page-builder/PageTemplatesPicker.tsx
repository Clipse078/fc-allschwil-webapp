"use client";

/**
 * components/admin/page-builder/PageTemplatesPicker.tsx
 *
 * Dialog that lets editors choose a page template when creating a new page
 * or applying a starter block structure to an existing page.
 *
 * Uses GET /api/website-pages/templates to list templates.
 * Uses POST /api/website-pages/[id]/apply-template to apply a selected one.
 */

import { useState } from "react";
import {
  FileText,
  Trophy,
  Users,
  Award,
  Calendar,
  ClipboardList,
  HelpCircle,
  X,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { PageTemplate } from "@/lib/cms/page-templates";

const ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText className="h-5 w-5" />,
  Trophy: <Trophy className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Award: <Award className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  ClipboardList: <ClipboardList className="h-5 w-5" />,
  HelpCircle: <HelpCircle className="h-5 w-5" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  content: "Inhalt",
  club: "Verein",
  conversion: "Konversion",
  event: "Veranstaltung",
  other: "Sonstiges",
};

type Props = {
  open: boolean;
  pageId: string;
  onClose: () => void;
  onApplied: () => void;
};

export default function PageTemplatesPicker({ open, pageId, onClose, onApplied }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadedTemplates, setLoadedTemplates] = useState<PageTemplate[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadTemplates() {
    if (loadedTemplates !== null) return;
    setLoading(true);
    try {
      const res = await fetch("/api/website-pages/templates");
      const data = await res.json();
      setLoadedTemplates(data.templates ?? []);
    } catch {
      setLoadedTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  // Load on open
  if (open && loadedTemplates === null && !loading) {
    void loadTemplates();
  }

  async function applyTemplate() {
    if (!selectedId) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler beim Anwenden der Vorlage");
      setSuccess(true);
      setTimeout(() => {
        onApplied();
        onClose();
        setSuccess(false);
        setSelectedId(null);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setApplying(false);
    }
  }

  if (!open) return null;

  const displayTemplates = loadedTemplates ?? [];

  // Group by category
  const grouped = new Map<string, PageTemplate[]>();
  for (const t of displayTemplates) {
    const list = grouped.get(t.category) ?? [];
    list.push(t);
    grouped.set(t.category, list);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-[var(--surface)] shadow-2xl border border-[var(--border)] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-[var(--text-2)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Seitenvorlage anwenden</h2>
              <p className="text-[11px] text-[var(--muted)]">Starter-Blöcke werden zur Seite hinzugefügt (bestehende Sektionen bleiben erhalten).</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="sce-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-[var(--muted)]">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Vorlagen laden…
            </div>
          )}

          {!loading && displayTemplates.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--muted)]">Keine Vorlagen verfügbar.</p>
          )}

          {!loading && displayTemplates.length > 0 && (
            <div className="space-y-5">
              {Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {CATEGORY_LABELS[category] ?? category}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                          selectedId === t.id
                            ? "border-[var(--brand-primary,#f97316)] bg-orange-50 ring-1 ring-[var(--brand-primary,#f97316)]"
                            : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
                        }`}
                      >
                        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-2)]">
                          {ICON_MAP[t.icon] ?? <FileText className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--foreground)]">{t.displayName}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t.description}</p>
                          <p className="mt-1 text-[10px] text-[var(--muted)]">
                            {t.sections.length} Sektionen
                          </p>
                        </div>
                        {selectedId === t.id && (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-orange-500 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-3 flex items-center justify-between">
          <div>
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Vorlage angewendet!
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="fca-button-secondary py-1.5 text-xs">
              Abbrechen
            </button>
            <button
              type="button"
              onClick={applyTemplate}
              disabled={!selectedId || applying}
              className="fca-button-primary py-1.5 text-xs disabled:opacity-50"
            >
              {applying ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Anwenden…
                </>
              ) : (
                <>
                  <Layers className="h-3.5 w-3.5" />
                  Vorlage anwenden
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
