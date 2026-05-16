"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { createWebsitePage } from "@/app/(admin)/dashboard/website/actions";
import type { WebsiteTemplate } from "@/lib/website/template-catalog";

type Props = {
  templates: WebsiteTemplate[];
  defaultLocale: string;
  hasDuplicateError?: boolean;
  duplicateSlug?: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export default function CreatePageForm({
  templates,
  defaultLocale,
  hasDuplicateError,
  duplicateSlug,
}: Props) {
  const [selectedKey, setSelectedKey] = useState(templates[0]?.key ?? "");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  function handleSlugChange(v: string) {
    setSlug(slugify(v));
    setSlugEdited(true);
  }

  const selectedTemplate = templates.find((t) => t.key === selectedKey);

  return (
    <div className="space-y-5">
      {/* Guidance */}
      <div className="flex items-start gap-2.5 rounded-[16px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-4 py-3">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
        <p className="text-[12px] text-slate-600">
          Beginne mit einer Vorlage. Du kannst die Blöcke und Inhalte später
          anpassen.
        </p>
      </div>

      {hasDuplicateError && (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Slug{" "}
          <span className="font-mono font-semibold">
            {duplicateSlug}
          </span>{" "}
          existiert bereits für diese Sprache. Wähle einen anderen Slug.
        </div>
      )}

      <form action={createWebsitePage} className="space-y-4">
        <input type="hidden" name="locale" value={defaultLocale} />

        {/* Template selector */}
        <div>
          <label className="text-sm font-semibold text-slate-700">
            Vorlage wählen
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((tpl) => (
              <label
                key={tpl.key}
                className={`flex cursor-pointer items-start gap-3 rounded-[14px] border p-3 transition ${
                  selectedKey === tpl.key
                    ? "border-[#0b4aa2] bg-[#0b4aa2]/5 ring-1 ring-[#0b4aa2]/20"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="templateKey"
                  value={tpl.key}
                  checked={selectedKey === tpl.key}
                  onChange={() => setSelectedKey(tpl.key)}
                  className="mt-0.5 shrink-0 accent-[#0b4aa2]"
                  required
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">
                    {tpl.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {tpl.suggestedBlocks.length} Blöcke
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Title + slug */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Seitentitel
            </label>
            <input
              name="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              placeholder={selectedTemplate?.label ?? "z. B. Homepage"}
              className="mt-1.5 h-10 w-full rounded-[12px] border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Slug
            </label>
            <div className="mt-1.5 flex items-center rounded-[12px] border border-slate-200 focus-within:border-[#0b4aa2] focus-within:ring-2 focus-within:ring-[#0b4aa2]/10">
              <span className="pl-3 text-sm text-slate-400">/</span>
              <input
                name="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="home"
                className="h-10 flex-1 bg-transparent px-2 text-sm text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Suggested blocks preview */}
        {selectedTemplate && (
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Vorgeschlagene Blöcke
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedTemplate.suggestedBlocks.map((b, i) => (
                <span
                  key={i}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  {b.type}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!title.trim() || !selectedKey}
          className="rounded-full bg-[#0b4aa2] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a] disabled:opacity-50"
        >
          Seite erstellen (Entwurf)
        </button>
      </form>
    </div>
  );
}
