"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { TARGET_TEMPLATES, CATEGORY_LABELS, type TargetTemplate } from "@/lib/targets/templates";

const CATEGORY_COLORS: Record<TargetTemplate["category"], string> = {
  SPORTLICHE_ENTWICKLUNG: "bg-blue-50 border-blue-200 text-blue-700",
  MITGLIEDERWACHSTUM: "bg-emerald-50 border-emerald-200 text-emerald-700",
  FINANZEN: "bg-amber-50 border-amber-200 text-amber-700",
  AUSBILDUNG: "bg-violet-50 border-violet-200 text-violet-700",
  MEDIEN_SOZIALES: "bg-pink-50 border-pink-200 text-pink-700",
  GOVERNANCE: "bg-slate-100 border-slate-300 text-slate-700",
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
    <section className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-6 text-left"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[#3f63b5]" />
          <div>
            <p className="text-[1.02rem] font-semibold text-slate-900">
              Vorlagen-Katalog
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {TARGET_TEMPLATES.length} kuratierte Vorlagen für Sport-Vereinsziele
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded ? (
        <div className="border-t border-slate-100 p-6 pt-4">
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                selectedCategory === "ALL"
                  ? "border-[#3f63b5] bg-[#3f63b5] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                      ? "border-[#3f63b5] bg-[#3f63b5] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                className="rounded-[20px] border border-slate-200/80 bg-slate-50 p-4 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[template.category]}`}
                  >
                    {CATEGORY_LABELS[template.category]}
                  </span>
                  {template.ageGroupHint ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                      {template.ageGroupHint}
                    </span>
                  ) : null}
                </div>

                <p className="text-[13px] font-semibold text-slate-900 leading-5">
                  {template.title}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 leading-4">
                  {template.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {template.metrics.map((m) => (
                    <span
                      key={m.label}
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600"
                    >
                      {m.label}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onSelect(template)}
                  className="mt-4 w-full rounded-[14px] border border-[#3f63b5]/20 bg-[#3f63b5]/5 py-2 text-[12px] font-semibold text-[#3f63b5] transition hover:bg-[#3f63b5]/10"
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
