import { getInfoboardFeed } from "@/lib/events/public-event-feed";
import { prisma } from "@/lib/db/prisma";
import { getInfoboardPresetByKey, INFOBOARD_MODE_LABELS } from "@/lib/infoboard/infoboard-preset-catalog";
import InfoboardAutoRefresher from "@/components/infoboard/InfoboardAutoRefresher";

const FALLBACK_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";
const MIN_REFRESH = 15;
const MAX_REFRESH = 300;
const DEFAULT_REFRESH = 60;

type SearchProps = { searchParams?: Promise<{ tenantKey?: string; refresh?: string }> };

type InfoboardDisplayOptions = {
  showClubLogo?: boolean;
  showClubName?: boolean;
  showSponsorRotation?: boolean;
  showDateTime?: boolean;
  showDressingRooms?: boolean;
  showPitchNames?: boolean;
  showAnnouncementTicker?: boolean;
  showEmergencyBanner?: boolean;
  density?: "compact" | "balanced" | "spacious";
  sponsorVisibility?: "hidden" | "subtle" | "normal" | "prominent";
};

type SiteSettings = {
  infoboardPresetKey?: string | null;
  infoboardMode?: string | null;
  infoboardDisplayOptions?: InfoboardDisplayOptions | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  footerText?: string | null;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  TRAINING: "Training",
  MATCH: "Match",
  TOURNAMENT: "Turnier",
  OTHER: "Event",
  VACATION_PERIOD: "Ferien",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  TRAINING: "bg-emerald-600",
  MATCH: "bg-blue-600",
  TOURNAMENT: "bg-amber-600",
  OTHER: "bg-slate-500",
  VACATION_PERIOD: "bg-rose-600",
};

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(d);
}

function formatDateShort(d: Date) {
  return new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d);
}

function formatFullDateTime(d: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(d);
}

function isToday(d: Date, now: Date) {
  return d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
}

export default async function InfoboardPage({ searchParams }: SearchProps) {
  const params = (await searchParams) ?? {};
  const tenantKey = params.tenantKey?.trim() || FALLBACK_TENANT_KEY;
  const rawRefresh = parseInt(params.refresh ?? "", 10);
  const refreshSeconds = isNaN(rawRefresh)
    ? DEFAULT_REFRESH
    : Math.min(MAX_REFRESH, Math.max(MIN_REFRESH, rawRefresh));

  // Load site settings
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey },
    select: { name: true, settingsJson: true },
  });

  const sj = (site?.settingsJson ?? {}) as SiteSettings;
  const opts: InfoboardDisplayOptions = {
    showClubLogo: true, showClubName: true, showSponsorRotation: true,
    showDateTime: true, showDressingRooms: false, showPitchNames: true,
    showAnnouncementTicker: true, showEmergencyBanner: true,
    density: "balanced", sponsorVisibility: "normal",
    ...sj.infoboardDisplayOptions,
  };

  const preset = sj.infoboardPresetKey ? getInfoboardPresetByKey(sj.infoboardPresetKey) : null;
  const mode = (sj.infoboardMode ?? preset?.mode ?? "LIGHT") as "LIGHT" | "DARK" | "AUTO";
  const isDark = mode === "DARK";
  const tokenBg = preset?.previewTokens?.bg;
  const tokenAccent = preset?.previewTokens?.accent;
  const primary = sj.primaryColor ?? preset?.previewTokens?.accent ?? (isDark ? "#1e3a5f" : "#0b4aa2");

  // Load events (next 14 days)
  const now = new Date();
  const dateTo = new Date(now);
  dateTo.setUTCDate(dateTo.getUTCDate() + 14);

  const events = await getInfoboardFeed({
    dateFrom: now.toISOString(),
    dateTo: dateTo.toISOString(),
    limit: 20,
  });

  const todayEvents = events.filter((e) => isToday(e.startAt, now));
  const upcomingEvents = events.filter((e) => !isToday(e.startAt, now)).slice(0, 8);

  // Styling
  const bg = tokenBg ?? (isDark ? "#0f172a" : "#f8fafc");
  const textPrimary = isDark ? "#f1f5f9" : "#0f172a";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const cardBg = isDark ? "#1e293b" : "#ffffff";
  const cardBorder = isDark ? "#334155" : "#e2e8f0";
  const densityPy = opts.density === "compact" ? "py-2" : opts.density === "spacious" ? "py-5" : "py-3";

  const siteName = site?.name ?? "SportClubEvo";

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: bg, color: textPrimary, fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between gap-4 px-6 py-4"
        style={{ backgroundColor: primary }}
      >
        <div className="flex items-center gap-3">
          {opts.showClubLogo !== false && sj.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sj.logoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover" />
          )}
          {opts.showClubLogo !== false && !sj.logoUrl && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
              {siteName.charAt(0)}
            </div>
          )}
          {opts.showClubName !== false && (
            <span className="text-lg font-bold text-white">{siteName}</span>
          )}
          {preset && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
              {preset.name}
            </span>
          )}
        </div>

        {opts.showDateTime !== false && (
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{formatFullDateTime(now)}</p>
            <InfoboardAutoRefresher
              intervalSeconds={refreshSeconds}
              showTimestamp={opts.showDateTime !== false as boolean}
            />
          </div>
        )}
      </header>

      <div className="grid gap-0 p-6 lg:grid-cols-[minmax(0,1.8fr)_320px]">
        {/* Main: Schedule */}
        <main className="space-y-5">
          {/* Today */}
          <section>
            <p
              className="mb-3 text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: textSecondary }}
            >
              Heute · {formatDateShort(now)}
            </p>

            {todayEvents.length === 0 ? (
              <div
                className="rounded-[14px] border p-4 text-sm"
                style={{ borderColor: cardBorder, backgroundColor: cardBg, color: textSecondary }}
              >
                Keine Events heute.
              </div>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`flex items-start gap-4 rounded-[16px] border ${densityPy} px-4`}
                    style={{ borderColor: cardBorder, backgroundColor: cardBg }}
                  >
                    <div
                      className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${EVENT_TYPE_COLORS[ev.type] ?? "bg-slate-500"}`}
                    >
                      {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold" style={{ color: textPrimary }}>
                        {ev.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm" style={{ color: textSecondary }}>
                        <span>{formatTime(ev.startAt)}{ev.endAt ? ` – ${formatTime(ev.endAt)}` : ""}</span>
                        {ev.location && <span>📍 {ev.location}</span>}
                        {ev.teamName && <span>👥 {ev.teamName}</span>}
                        {ev.opponentName && <span>vs. {ev.opponentName}</span>}
                      </div>
                    </div>
                    {opts.showPitchNames !== false && ev.location && (
                      <div className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                        style={{ borderColor: cardBorder, color: textSecondary }}>
                        {ev.location}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming */}
          {upcomingEvents.length > 0 && (
            <section>
              <p
                className="mb-3 text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: textSecondary }}
              >
                Kommende Events
              </p>
              <div className="space-y-1.5">
                {upcomingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`flex items-center gap-3 rounded-[12px] border px-4 py-2`}
                    style={{ borderColor: cardBorder, backgroundColor: cardBg }}
                  >
                    <span className="w-20 shrink-0 text-[12px] font-semibold" style={{ color: textSecondary }}>
                      {formatDateShort(ev.startAt)}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: textSecondary }}>
                      {formatTime(ev.startAt)}
                    </span>
                    <div
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${EVENT_TYPE_COLORS[ev.type] ?? "bg-slate-500"}`}
                    >
                      {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: textPrimary }}>
                      {ev.title}
                    </span>
                    {ev.teamName && (
                      <span className="shrink-0 text-[11px]" style={{ color: textSecondary }}>
                        {ev.teamName}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        {/* Sidebar */}
        <aside className="space-y-4 pl-6">
          {/* Sponsor strip */}
          {opts.showSponsorRotation !== false && opts.sponsorVisibility !== "hidden" && (
            <div
              className="rounded-[14px] border p-4"
              style={{ borderColor: cardBorder, backgroundColor: cardBg }}
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: textSecondary }}>
                Sponsoren
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 flex-1 rounded-[8px]"
                    style={{ backgroundColor: isDark ? "#334155" : "#e2e8f0", minWidth: "60px" }}
                  />
                ))}
              </div>
              <p className="mt-2 text-[10px]" style={{ color: textSecondary }}>
                Sponsor-Logos werden nach Konfiguration eingeblendet.
              </p>
            </div>
          )}

          {/* Dressing rooms */}
          {opts.showDressingRooms && (
            <div
              className="rounded-[14px] border p-4"
              style={{ borderColor: cardBorder, backgroundColor: cardBg }}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: textSecondary }}>
                Garderoben
              </p>
              <p className="text-sm" style={{ color: textSecondary }}>
                Garderobenzuteilung wird aus dem Wochenplan geladen.
              </p>
            </div>
          )}

          {/* Summary */}
          <div
            className="rounded-[14px] border p-3"
            style={{ borderColor: cardBorder, backgroundColor: cardBg }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: textSecondary }}>
              Status
            </p>
            <p className="mt-1 text-sm font-semibold" style={{ color: textPrimary }}>
              {todayEvents.length} Events heute
            </p>
            <p className="text-[11px]" style={{ color: textSecondary }}>
              {events.length} in den nächsten 14 Tagen
            </p>
            {preset && (
              <p className="mt-1 text-[10px]" style={{ color: textSecondary }}>
                Preset: {preset.name} · {INFOBOARD_MODE_LABELS[mode]}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Announcement ticker */}
      {opts.showAnnouncementTicker !== false && (
        <footer
          className="px-6 py-3 text-sm font-medium"
          style={{ backgroundColor: primary, color: "rgba(255,255,255,0.85)" }}
        >
          {sj.footerText ?? `${siteName} · Infoboard · Alle Angaben ohne Gewähr`}
        </footer>
      )}

      {/* Emergency banner (placeholder - enabled but no active announcement) */}
      {opts.showEmergencyBanner !== false && false /* no active emergency */ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/95">
          <p className="text-4xl font-bold text-white">Notfallmeldung</p>
        </div>
      )}
    </div>
  );
}
