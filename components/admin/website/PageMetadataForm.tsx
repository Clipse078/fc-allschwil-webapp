"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Lightbulb } from "lucide-react";
import { updatePageMetadata } from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";

const PAGE_TYPES = [
  { value: "HOMEPAGE", label: "Homepage" },
  { value: "TEAMS_OVERVIEW", label: "Teams Übersicht" },
  { value: "TEAM_DETAIL", label: "Team-Detailseite" },
  { value: "CLUB_ABOUT", label: "Über den Verein" },
  { value: "CONTACT", label: "Kontakt" },
  { value: "REGISTRATION", label: "Anmeldung" },
  { value: "NEWS_OVERVIEW", label: "News Übersicht" },
  { value: "NEWS_DETAIL", label: "News Artikel" },
  { value: "EVENTS_OVERVIEW", label: "Veranstaltungen" },
  { value: "SPONSORS_PARTNERS", label: "Sponsoren & Partner" },
  { value: "LEGAL", label: "Impressum / Datenschutz" },
  { value: "CUSTOM", label: "Eigene Seite" },
];

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

type Props = {
  pageId: string;
  initialTitle: string;
  initialSlug: string;
  initialPageType: string;
  hasLiveSnapshot: boolean;
};

export default function PageMetadataForm({
  pageId, initialTitle, initialSlug, initialPageType, hasLiveSnapshot,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [pageType, setPageType] = useState(initialPageType);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugEdited) setSlug(slugify(v));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      fd.append("title", title);
      fd.append("slug", slug);
      fd.append("pageType", pageType);
      const result = await updatePageMetadata(fd);
      if (result.ok) setSaved(true);
      else setError(result.error);
    });
  }

  const base =
    "w-full rounded-[12px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10";
  const isDirty = title !== initialTitle || slug !== initialSlug || pageType !== initialPageType;

  return (
    <div className="space-y-3">
      {hasLiveSnapshot && slug !== initialSlug && (
        <div className="flex items-start gap-2 rounded-[12px] border border-amber-100 bg-amber-50/70 px-3 py-2">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-800">
            Publizierte Snapshots verwenden den alten Slug bis du erneut publizierst.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold text-slate-500">Seitentitel</label>
          <input
            className={`mt-1 h-9 ${base}`}
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500">Slug</label>
          <div className="mt-1 flex items-center rounded-[12px] border border-slate-200 focus-within:border-[#0b4aa2] focus-within:ring-2 focus-within:ring-[#0b4aa2]/10">
            <span className="pl-3 text-sm text-slate-400">/</span>
            <input
              className="h-9 flex-1 bg-transparent px-2 text-sm text-slate-900 outline-none"
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); setSaved(false); }}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-slate-500">Seitentyp</label>
        <select
          className={`mt-1 h-9 ${base}`}
          value={pageType}
          onChange={(e) => { setPageType(e.target.value); setSaved(false); }}
        >
          {PAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-[12px] text-emerald-800">Metadaten gespeichert.</p>
        </div>
      )}
      {error && (
        <p className="text-[11px] text-rose-600">{error}</p>
      )}

      {isDirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !title.trim() || !slug.trim()}
          className="rounded-full bg-[#0b4aa2] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Speichern …" : "Metadaten speichern"}
        </button>
      )}
    </div>
  );
}
