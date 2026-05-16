import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  Lightbulb,
  Monitor,
  Target,
  XCircle,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  INFOBOARD_PRESETS,
  INFOBOARD_MODE_LABELS,
  getInfoboardPresetByKey,
  type InfoboardMode,
} from "@/lib/infoboard/infoboard-preset-catalog";

type Props = { params: Promise<{ key: string }> };

// Infoboard wireframe block heights (landscape layout)
const SCREEN_BLOCK_H: Record<string, string> = {
  "fullscreen-hero": "h-28",
  "fullscreen-alert": "h-28",
  "fullscreen-sponsor": "h-28",
  "rotating-hero": "h-28",
  "colourful-header": "h-10",
  "tournament-header": "h-10",
  header: "h-8",
  "date-header": "h-8",
  "date-time-header": "h-8",
  "logo-bar": "h-8",
  "match-details": "h-18",
  "bracket-display": "h-20",
  "news-panel": "h-16",
  "news-ticker": "h-6",
  "sponsor-ticker": "h-6",
  "results-stream": "h-14",
  "rotating-logos": "h-10",
  "today-schedule": "h-16",
  "full-day-schedule": "h-20",
  "upcoming-events": "h-14",
  "next-events-list": "h-18",
  "next-3-events": "h-14",
  "next-events": "h-14",
  "schedule-strip": "h-8",
  "split-schedule-sponsor": "h-18",
  "sponsors-bar": "h-8",
  "team-lineup": "h-14",
  "team-of-the-week": "h-12",
  "pitch-grid": "h-16",
  "roles-strip": "h-8",
  "roles-overview": "h-14",
  announcements: "h-10",
  "internal-announcements": "h-10",
  "message-body": "h-20",
  "contact-strip": "h-8",
  "contact-info": "h-8",
  "score": "h-12",
  "lineups": "h-16",
  "group-standings": "h-16",
  "next-match": "h-14",
  "next-event": "h-12",
  "next-training": "h-12",
  "staff-notes": "h-10",
  "large-clock": "h-16",
};

function parseRhythm(rhythm: string): string[] {
  return rhythm.split("→").map((s) => s.trim()).filter(Boolean);
}

function getBlockLabel(name: string): string {
  const m: Record<string, string> = {
    header: "Kopfzeile",
    "colourful-header": "Farbige Kopfzeile",
    "date-header": "Datum",
    "date-time-header": "Datum & Uhrzeit",
    "logo-bar": "Logo-Zeile",
    "tournament-header": "Turnier-Header",
    "today-schedule": "Tagesplan",
    "full-day-schedule": "Vollständiger Tagesplan",
    "upcoming-events": "Kommende Events",
    "next-events-list": "Nächste Events",
    "next-3-events": "Nächste 3 Events",
    "next-events": "Nächste Events",
    "next-event": "Nächstes Event",
    "next-match": "Nächstes Spiel",
    "next-training": "Nächstes Training",
    "news-ticker": "News-Ticker",
    "news-panel": "News-Panel",
    "sponsor-ticker": "Sponsor-Ticker",
    "sponsors-bar": "Sponsorenzeile",
    "rotating-logos": "Rotierende Logos",
    "schedule-strip": "Spielplan-Zeile",
    "split-schedule-sponsor": "Spielplan + Sponsor",
    "team-lineup": "Aufstellung",
    "team-of-the-week": "Team der Woche",
    "pitch-grid": "Platzbelegung",
    "roles-strip": "Helfer-Zeile",
    "roles-overview": "Helferplan",
    announcements: "Ankündigungen",
    "internal-announcements": "Interne Meldungen",
    "staff-notes": "Mitarbeiter-Notizen",
    "match-details": "Spieldetails",
    score: "Spielstand",
    lineups: "Aufstellungen",
    "bracket-display": "Turnierbaum",
    "group-standings": "Gruppenstand",
    "results-stream": "Ergebnis-Stream",
    "fullscreen-hero": "Vollbild Hero",
    "fullscreen-alert": "Vollbild Alarm",
    "fullscreen-sponsor": "Vollbild Sponsor",
    "rotating-hero": "Rotierendes Bild",
    "large-clock": "Grosse Uhr",
    "message-body": "Meldungstext",
    "contact-strip": "Kontakt-Zeile",
    "contact-info": "Kontaktdaten",
  };
  return m[name.toLowerCase()] ?? name;
}

const MODE_STYLE: Record<InfoboardMode, { bg: string; text: string; badge: string }> = {
  LIGHT: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    badge: "border-slate-300 bg-white text-slate-700",
  },
  DARK: {
    bg: "bg-slate-900",
    text: "text-slate-300",
    badge: "border-slate-600 bg-slate-800 text-slate-300",
  },
  AUTO: {
    bg: "bg-slate-200",
    text: "text-slate-600",
    badge: "border-slate-300 bg-slate-50 text-slate-600",
  },
};

const SPONSOR_LABELS: Record<string, string> = {
  none: "Keine",
  subtle: "Dezent",
  standard: "Standard",
  prominent: "Prominent",
};

const SCHEDULE_LABELS: Record<string, string> = {
  minimal: "Minimal",
  compact: "Kompakt",
  full: "Vollständig",
};

export default async function InfoboardPresetPreviewPage({ params }: Props) {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const { key } = await params;
  const preset = getInfoboardPresetByKey(key);
  if (!preset) notFound();

  const blocks = parseRhythm(preset.layoutRhythm);
  const modeStyle = MODE_STYLE[preset.mode];
  const tokenBg = preset.previewTokens?.bg;
  const tokenAccent = preset.previewTokens?.accent;

  const others = INFOBOARD_PRESETS.filter((p) => p.key !== key).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/website/settings"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Einstellungen
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{preset.name}</h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${modeStyle.badge}`}>
              <Monitor className="mr-1 inline h-3 w-3" />
              {INFOBOARD_MODE_LABELS[preset.mode]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{preset.bestUseCase}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        {/* Landscape infoboard wireframe */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Bildschirm-Vorschau (Querformat)
          </p>
          <div
            className="overflow-hidden rounded-[16px] border border-slate-300/80 shadow-[0_8px_24px_rgba(15,23,42,0.1)]"
            style={{ backgroundColor: tokenBg ?? (preset.mode === "DARK" ? "#0f172a" : "#ffffff"), aspectRatio: "16/9" }}
          >
            {/* Screen chrome */}
            <div
              className="flex h-6 items-center gap-1.5 px-3"
              style={{ backgroundColor: tokenAccent ?? (preset.mode === "DARK" ? "#1e293b" : "#f1f5f9") }}
            >
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            {/* Content */}
            <div className="space-y-1.5 p-3">
              {blocks.map((block, i) => {
                const h = SCREEN_BLOCK_H[block.toLowerCase()] ?? "h-10";
                const isHero = i === 0 || block.includes("fullscreen") || block.includes("hero") || block.includes("alert");
                const blockBg = isHero
                  ? (tokenAccent ?? "#334155")
                  : (preset.mode === "DARK" ? "#1e293b" : "#e2e8f0");
                return (
                  <div
                    key={i}
                    className={`flex w-full items-center justify-center rounded-[6px] ${h}`}
                    style={{ backgroundColor: blockBg, opacity: isHero ? 0.9 : 0.7 }}
                  >
                    <span
                      className="rounded px-2 py-0.5 text-[9px] font-semibold"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.8)",
                        color: "#1e293b",
                      }}
                    >
                      {getBlockLabel(block)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{preset.description}</p>

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Sponsor-Sichtbarkeit", value: SPONSOR_LABELS[preset.sponsorVisibilityLevel] },
              { label: "Kalender-Dichte", value: SCHEDULE_LABELS[preset.scheduleDensity] },
              { label: "Alarm-Support", value: preset.alertAnnouncementSupport ? "Ja" : "Nein" },
              { label: "Modus", value: INFOBOARD_MODE_LABELS[preset.mode] },
            ].map((s) => (
              <div key={s.label} className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold text-slate-400">{s.label}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Guidance cards */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 rounded-[13px] border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-[11px] font-semibold text-emerald-800">Ideal wenn …</p>
                <p className="mt-0.5 text-[11px] text-emerald-700">{preset.bestUsedWhen}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-[13px] border border-rose-100 bg-rose-50/60 px-3 py-2.5">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              <div>
                <p className="text-[11px] font-semibold text-rose-700">Nicht ideal wenn …</p>
                <p className="mt-0.5 text-[11px] text-rose-600">{preset.notIdealWhen}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-[13px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-3 py-2.5">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
              <div>
                <p className="text-[11px] font-semibold text-[#0b4aa2]">Setup-Tipp</p>
                <p className="mt-0.5 text-[11px] text-slate-600">{preset.setupTip}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-[13px] border border-amber-100 bg-amber-50/70 px-3 py-2.5">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-[11px] font-semibold text-amber-800">Erste Aktion</p>
                <p className="mt-0.5 text-[11px] text-amber-700">{preset.firstRecommendedAction}</p>
              </div>
            </div>
            {preset.alertAnnouncementSupport && (
              <div className="flex items-center gap-2 rounded-[13px] border border-slate-200 bg-slate-50 px-3 py-2">
                <Bell className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[11px] text-slate-600">Unterstützt Alarm- und Ankündigungs-Modus.</p>
              </div>
            )}
          </div>

          {/* Recommended screens */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Empfohlene Bildschirme</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {preset.recommendedScreens.map((s) => (
                <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <Link
            href="/dashboard/website/settings"
            className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a]"
          >
            Dieses Infoboard-Preset wählen
          </Link>
        </div>
      </div>

      {/* Other presets */}
      {others.length > 0 && (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-[1rem] font-semibold text-slate-900">Andere Infoboard-Presets</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {others.map((p) => (
              <Link
                key={p.key}
                href={`/dashboard/website/infoboard-preset-preview/${p.key}`}
                className="group rounded-[16px] border border-slate-200/80 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-center gap-2">
                  {p.previewTokens?.bg && (
                    <span className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm" style={{ backgroundColor: p.previewTokens.bg }} />
                  )}
                  <p className="text-[12px] font-semibold text-slate-800 group-hover:text-[#0b4aa2]">{p.name}</p>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${MODE_STYLE[p.mode].badge}`}>
                    {INFOBOARD_MODE_LABELS[p.mode]}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">{p.bestUseCase}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
