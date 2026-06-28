"use client";

/**
 * components/admin/cms/BlockGalleryModal.tsx
 *
 * Shared Block Gallery modal — used by both HomepageSectionList and
 * PageBuilderClient. Editors choose a template here instead of selecting
 * internal block type keys.
 *
 * Props:
 *   open         — controls visibility
 *   target       — "homepage" | "page" (filters which templates are shown)
 *   onClose      — called when the modal is dismissed without inserting
 *   onInsert     — called with the selected template; caller handles the API call
 *   inserting    — while true, shows a loading state on the insert button
 *   insertError  — error message to show below the insert button
 */

import { useState, useEffect, useCallback } from "react";
import {
  X,
  LayoutTemplate,
  LayoutPanelLeft,
  MousePointerClick,
  Users,
  Award,
  Newspaper,
  Calendar,
  CalendarDays,
  Images,
  Video,
  Columns2,
  Sparkles,
  Clock,
} from "lucide-react";
import {
  GALLERY_CATEGORIES,
  BLOCK_TEMPLATES,
  getTemplatesByTargetAndCategory,
  type BlockTemplate,
  type GalleryCategory,
} from "@/lib/cms/block-template-registry";

// ---------------------------------------------------------------------------
// Icon map (Lucide icon name → component)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutTemplate,
  LayoutPanelLeft,
  MousePointerClick,
  Users,
  Award,
  Newspaper,
  Calendar,
  CalendarDays,
  Images,
  Video,
  Columns2,
  Sparkles,
};

function BlockIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? LayoutTemplate;
  return <Icon className={className ?? "h-5 w-5"} />;
}

// ---------------------------------------------------------------------------
// Category labels (German)
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<GalleryCategory, string> = {
  Hero: "Hero",
  Content: "Inhalt",
  CTA: "Call-to-Action",
  Media: "Medien",
  Club: "Verein",
  Dynamic: "Dynamisch",
};

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: BlockTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={template.comingSoon ? undefined : onSelect}
      disabled={template.comingSoon}
      className={`group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all focus:outline-none ${
        template.comingSoon
          ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] opacity-50"
          : selected
            ? "border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-500/20"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm"
      }`}
      title={template.comingSoon ? (template.comingSoonNote ?? "Demnächst verfügbar") : undefined}
    >
      {/* Coming-soon badge */}
      {template.comingSoon && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          <Clock className="h-2.5 w-2.5" />
          Demnächst
        </span>
      )}

      {/* Icon */}
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
          selected
            ? "bg-blue-500 text-white"
            : "bg-[var(--surface-2)] text-[var(--text-2)] group-hover:bg-blue-100 group-hover:text-blue-600"
        }`}
      >
        <BlockIcon name={template.icon} className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold leading-tight ${
            selected ? "text-blue-700" : "text-[var(--foreground)]"
          }`}
        >
          {template.label}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-[var(--muted)] line-clamp-2">
          {template.description}
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// BlockGalleryModal
// ---------------------------------------------------------------------------

export type BlockGalleryModalProps = {
  open: boolean;
  target: "homepage" | "page";
  onClose: () => void;
  onInsert: (template: BlockTemplate) => void;
  inserting?: boolean;
  insertError?: string | null;
};

export default function BlockGalleryModal({
  open,
  target,
  onClose,
  onInsert,
  inserting = false,
  insertError = null,
}: BlockGalleryModalProps) {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>("Content");
  const [selectedId, setSelectedId] = useState<string | null>("split-content-cards-club");

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const byCategory = getTemplatesByTargetAndCategory(target);

  const selectedTemplate = selectedId
    ? BLOCK_TEMPLATES.find((t) => t.id === selectedId) ?? null
    : null;

  const handleInsert = useCallback(() => {
    if (selectedTemplate && !selectedTemplate.comingSoon) {
      onInsert(selectedTemplate);
    }
  }, [selectedTemplate, onInsert]);

  if (!open) return null;

  // Categories that have at least one template for this target
  const availableCategories = GALLERY_CATEGORIES.filter(
    (cat) => (byCategory.get(cat)?.length ?? 0) > 0,
  );

  const currentTemplates = byCategory.get(activeCategory) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[90vh] max-h-[700px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Block hinzufügen</p>
              <p className="text-[11px] text-[var(--muted)]">
                Wähle eine Vorlage und füge sie ein
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Category sidebar */}
          <nav className="hidden w-40 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--border)] p-3 sm:flex">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => { setActiveCategory(cat); setSelectedId(null); }}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                  activeCategory === cat
                    ? "bg-blue-50 text-blue-700"
                    : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </nav>

          {/* Mobile: horizontal scroll category tabs */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex overflow-x-auto border-b border-[var(--border)] px-3 py-2 gap-1 sm:hidden">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setActiveCategory(cat); setSelectedId(null); }}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                    activeCategory === cat
                      ? "bg-blue-500 text-white"
                      : "bg-[var(--surface-2)] text-[var(--text-2)]"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Template grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {CATEGORY_LABELS[activeCategory]}
              </p>
              {currentTemplates.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">
                  Keine Vorlagen in dieser Kategorie.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {currentTemplates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      selected={selectedId === tpl.id}
                      onSelect={() => setSelectedId(tpl.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <div className="min-w-0 flex-1">
            {selectedTemplate && !selectedTemplate.comingSoon ? (
              <p className="truncate text-xs text-[var(--text-2)]">
                <span className="font-medium text-[var(--foreground)]">
                  {selectedTemplate.label}
                </span>{" "}
                ausgewählt
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">Vorlage auswählen um fortzufahren</p>
            )}
            {insertError && (
              <p className="mt-0.5 text-xs text-rose-600">{insertError}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={inserting}
              className="fca-button-secondary px-3 py-1.5 text-xs"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={
                !selectedTemplate ||
                selectedTemplate.comingSoon ||
                inserting
              }
              className="fca-button-primary px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {inserting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Wird eingefügt…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Block einfügen
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
