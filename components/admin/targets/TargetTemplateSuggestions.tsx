"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { TARGET_TEMPLATES, CATEGORY_LABELS, type TargetTemplate } from "@/lib/targets/templates";

const CATEGORY_COLORS: Record<TargetTemplate["category"], string> = {
  SPORTLICHE_ENTWICKLUNG: "sce-chip-primary",
  MITGLIEDERWACHSTUM: "sce-chip-success",
  FINANZEN: "sce-chip-warning",
  AUSBILDUNG: "sce-chip-primary",
  MEDIEN_SOZIALES: "sce-chip-primary",
  GOVERNANCE: "",
};

type TargetTemplateSuggestionsProps = {
  onSelect: (template: TargetTemplate) => void;
};

export default function TargetTemplateSuggestions({ onSelect }: TargetTemplateSuggestionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TargetTemplate["category"] | "ALL">("ALL");

  const categories = Object.keys(CATEGORY_LABELS) as TargetTemplate["category"][];

  const filtered =
    selectedCategory === "ALL"
      ? TARGET_TEMPLATES
      : TARGET_TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <section className="sce-page-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-6 text-left"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[var(--sce-primary-strong)]" />
          <div>
            <p className="text-[1.02rem] font-semibold text-[var(--sce-heading)]">
              Vorlagen-Katalog
            </p>
            <p className="mt-0.5 text-sm text-[var(--sce-muted)]">
              {TARGET_TEMPLATES.length} kuratierte Vorlagen für Sport-Vereinsziele
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--sce-subtle)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded ? (
        <div className="border-t border-[var(--sce-border)] p-6 pt-4">
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                selectedCategory === "ALL"
                  ? "sce-chip-primary"
                  : "bg-[var(--sce-surface-strong)] text-[var(--sce-muted)] hover:bg-[var(--sce-surface-muted)]"
              }`}
            >
              Alle ({TARGET_TEMPLATES.length})
            </button>
            {categories.map((cat) => {
              const count = TARGET_TEMPLATES.filter((t) => t.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    selectedCategory === cat
                      ? "sce-chip-primary"
                      : "bg-[var(--sce-surface-strong)] text-[var(--sce-muted)] hover:bg-[var(--sce-surface-muted)]"
                  }`}
                >
                  {CATEGORY_LABELS[cat]} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="rounded-[20px] border border-[var(--sce-border)] bg-[var(--sce-surface-muted)] p-4 transition hover:border-[var(--sce-border-strong)] hover:shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span
                    className={`sce-chip px-2.5 py-0.5 text-[10px] ${CATEGORY_COLORS[template.category]}`}
                  >
                    {CATEGORY_LABELS[template.category]}
                  </span>
                  {template.ageGroupHint ? (
                    <span className="sce-chip px-2 py-0.5 text-[10px]">
                      {template.ageGroupHint}
                    </span>
                  ) : null}
                </div>

                <p className="text-[13px] font-semibold leading-5 text-[var(--sce-heading)]">
                  {template.title}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--sce-muted)]">
                  {template.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {template.metrics.map((m) => (
                    <span
                      key={m.label}
                      className="sce-chip px-2 py-0.5 text-[10px]"
                    >
                      {m.label}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onSelect(template)}
                  className="sce-action-primary mt-4 w-full py-2 text-[12px]"
                >
                  Vorlage verwenden
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
