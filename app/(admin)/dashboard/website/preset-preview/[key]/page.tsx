import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lightbulb, Target, XCircle } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsitePresetByKey, WEBSITE_PRESETS } from "@/lib/website/website-preset-catalog";
import { PAGE_TYPE_LABELS } from "@/lib/website/template-catalog";
import PresetPreviewCard from "@/components/admin/website/PresetPreviewCard";

type Props = { params: Promise<{ key: string }> };

// Block height map for the large wireframe
const BLOCK_H_LARGE: Record<string, string> = {
  "fullscreen-hero": "h-32",
  "full-width-hero": "h-32",
  "rotating-hero": "h-32",
  hero: "h-24",
  "full-width-image": "h-24",
  "stats-row": "h-10",
  "sponsors-bar": "h-10",
  "news-feed": "h-20",
  "event-list": "h-20",
  "team-grid": "h-24",
  "intro-text": "h-12",
  "rich-text": "h-16",
  "registration-cta": "h-14",
  "contact-info": "h-12",
  divider: "h-3",
};

function parseRhythm(rhythm: string): string[] {
  return rhythm
    .split("→")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getBlockLabel(name: string): string {
  const map: Record<string, string> = {
    hero: "Hero",
    "full-width-hero": "Vollbreites Hero",
    "fullscreen-hero": "Fullscreen Hero",
    "rotating-hero": "Rotierendes Hero",
    "stats-row": "Statistik-Zeile",
    "sponsors-bar": "Sponsorenzeile",
    "news-feed": "News-Feed",
    "event-list": "Veranstaltungen",
    "team-grid": "Team-Übersicht",
    "intro-text": "Einleitung",
    "rich-text": "Fliesstext",
    "registration-cta": "Anmeldung CTA",
    "contact-info": "Kontaktdaten",
    divider: "Trennlinie",
    "full-width-image": "Vollbreites Bild",
  };
  return map[name.toLowerCase()] ?? name;
}

export default async function PresetPreviewPage({ params }: Props) {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const { key } = await params;
  const preset = getWebsitePresetByKey(key);
  if (!preset) notFound();

  const blocks = parseRhythm(preset.homepageRhythm);
  const primary = preset.previewTokens?.primary ?? "#0b4aa2";
  const accent = preset.previewTokens?.accent ?? "#f1f5f9";

  // Other presets for navigation
  const otherPresets = WEBSITE_PRESETS.filter((p) => p.key !== key).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/website/settings"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Einstellungen
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{preset.name}</h1>
          <p className="mt-0.5 text-xs text-slate-400">{preset.visualTone}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Large wireframe */}
        <div className="space-y-4">
          <div
            className="overflow-hidden rounded-[20px] border border-slate-200/80 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
            style={{ backgroundColor: accent }}
          >
            {/* Nav bar */}
            <div
              className="h-8 w-full rounded-[8px]"
              style={{ backgroundColor: primary }}
            />
            {/* Blocks */}
            <div className="mt-2 space-y-2">
              {blocks.map((block, i) => {
                const h = BLOCK_H_LARGE[block.toLowerCase()] ?? "h-14";
                const isFill = i === 0 || block.includes("hero") || block.includes("full-width");
                return (
                  <div
                    key={i}
                    className={`relative w-full rounded-[8px] ${h} flex items-center justify-center`}
                    style={{
                      backgroundColor: isFill ? primary : "#cbd5e1",
                      opacity: isFill ? 0.8 : 0.5,
                    }}
                  >
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.85)",
                        color: isFill ? primary : "#475569",
                      }}
                    >
                      {getBlockLabel(block)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {preset.sportSuitability.map((s) => (
              <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                {s === "all" ? "Alle Sportarten" : s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{preset.description}</p>
          <p className="text-xs text-slate-400">Zielgruppe: {preset.audienceClubType}</p>
          <p className="text-xs text-slate-400">Navigation: {preset.navigationStyle}</p>

          {/* Guidance cards */}
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-[14px] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-[11px] font-semibold text-emerald-800">Ideal wenn …</p>
                <p className="mt-0.5 text-[11px] text-emerald-700">{preset.bestUsedWhen}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[14px] border border-rose-100 bg-rose-50/60 px-4 py-3">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              <div>
                <p className="text-[11px] font-semibold text-rose-700">Nicht ideal wenn …</p>
                <p className="mt-0.5 text-[11px] text-rose-600">{preset.notIdealWhen}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[14px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-4 py-3">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
              <div>
                <p className="text-[11px] font-semibold text-[#0b4aa2]">Setup-Tipp</p>
                <p className="mt-0.5 text-[11px] text-slate-600">{preset.setupTip}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[14px] border border-amber-100 bg-amber-50/70 px-4 py-3">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-[11px] font-semibold text-amber-800">Erste Aktion</p>
                <p className="mt-0.5 text-[11px] text-amber-700">{preset.firstRecommendedAction}</p>
              </div>
            </div>
          </div>

          {/* Recommended pages */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Empfohlene Seiten</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {preset.recommendedPages.map((pt) => (
                <span key={pt} className="rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-2.5 py-0.5 text-[11px] font-medium text-[#0b4aa2]">
                  {PAGE_TYPE_LABELS[pt as keyof typeof PAGE_TYPE_LABELS] ?? pt}
                </span>
              ))}
            </div>
          </div>

          {/* Select preset CTA */}
          <Link
            href={`/dashboard/website/settings#preset-${key}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a]"
          >
            Dieses Preset wählen
          </Link>
        </div>
      </div>

      {/* Other presets */}
      {otherPresets.length > 0 && (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-[1rem] font-semibold text-slate-900">Andere Presets</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {otherPresets.map((p) => (
              <Link key={p.key} href={`/dashboard/website/preset-preview/${p.key}`} className="group">
                <PresetPreviewCard preset={p} compact />
                <p className="mt-1.5 text-[12px] font-semibold text-slate-700 group-hover:text-[#0b4aa2]">
                  {p.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
