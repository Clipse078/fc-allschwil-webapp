import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  ExternalLink,
  FileText,
  Flag,
  Globe,
  Inbox,
  Newspaper,
  Plus,
  ScrollText,
  UserCircle2,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import {
  formatDate,
  formatTodayDate,
  getCurrentSeasonLabel,
  formatTime,
} from "@/lib/tenant-runtime/formatters";
import { KpiCard } from "@/components/admin/dashboard/KpiCard";
import DashboardTodayAgenda from "@/components/admin/dashboard/DashboardTodayAgenda";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { DashboardActionTile } from "@/components/admin/dashboard/DashboardActionTile";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { PageShell, PageHeader } from "@/components/ui/page";

// ── Types ─────────────────────────────────────────────────────────────────────

type DashboardPageProps = {
  searchParams?: Promise<{ season?: string }>;
};

// ── Data ──────────────────────────────────────────────────────────────────────

async function getDashboardData(tenantId: string | null) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // For tenant-scoped models (registrations, news, pages) filter when possible.
  // For global models (seasons, teams, persons, meetings, initiatives) query all.
  const tWhere = tenantId ? { tenantId } : {};

  const [
    openRegistrationCount,
    newsInReviewCount,
    pagesInReviewCount,
    scheduledNewsCount,
    seasonCount,
    teamCount,
    personCount,
    todayEvents,
    draftNewsCount,
    publishedNewsCount,
    draftPagesCount,
    publishedPagesCount,
    upcomingMeetings,
    activeInitiativeCount,
  ] = await Promise.all([
    // Action center — actionable items
    prisma.registration.count({ where: { ...tWhere, status: { in: ["NEW", "REVIEWING"] } } }),
    prisma.newsArticle.count({ where: { ...tWhere, status: "IN_REVIEW" } }),
    prisma.websitePage.count({ where: { ...tWhere, status: "IN_REVIEW" } }),
    prisma.newsArticle.count({ where: { ...tWhere, status: "SCHEDULED" } }),

    // Org KPIs
    prisma.season.count(),
    prisma.team.count(),
    prisma.person.count(),

    // Today's operations
    prisma.event.findMany({
      where: { startAt: { gte: todayStart, lt: todayEnd } },
      select: { id: true, title: true, type: true, startAt: true, location: true },
      orderBy: { startAt: "asc" },
      take: 8,
    }),

    // Website activity
    prisma.newsArticle.count({ where: { ...tWhere, status: "DRAFT" } }),
    prisma.newsArticle.count({ where: { ...tWhere, status: "PUBLISHED" } }),
    prisma.websitePage.count({ where: { ...tWhere, status: "DRAFT" } }),
    prisma.websitePage.count({ where: { ...tWhere, status: "PUBLISHED" } }),

    // Meetings & Initiatives
    prisma.meeting.findMany({
      where: { meetingDate: { gte: today }, status: "PLANNED" },
      select: { id: true, slug: true, title: true, meetingDate: true, location: true },
      orderBy: { meetingDate: "asc" },
      take: 4,
    }),
    prisma.initiative.count({ where: { status: { in: ["PLANNED", "IN_PROGRESS", "ON_TRACK"] } } }),
  ]);

  return {
    openRegistrationCount,
    newsInReviewCount,
    pagesInReviewCount,
    scheduledNewsCount,
    seasonCount,
    teamCount,
    personCount,
    todayEvents,
    draftNewsCount,
    publishedNewsCount,
    draftPagesCount,
    publishedPagesCount,
    upcomingMeetings,
    activeInitiativeCount,
  };
}

function mapEventType(t: string): "training" | "match" | "meeting" | "other" {
  if (t === "TRAINING") return "training";
  if (t === "MATCH") return "match";
  return "other";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const session = await auth();
  const tenantId = session?.user?.tenantId ?? null;

  const [seasonOptions, dash, ctx] = await Promise.all([
    getSeasonOptionsData(),
    getDashboardData(tenantId),
    getTenantContextFromSession(tenantId),
  ]);

  const fmtCfg = { locale: ctx?.locale ?? "de-CH", timezone: ctx?.timezone ?? undefined };
  const currentSeasonLabel = ctx ? getCurrentSeasonLabel(ctx) : null;
  const todayLabel = formatTodayDate(fmtCfg);
  const clubName = ctx?.name ?? "SportClubEvo";

  const selectedSeason =
    seasonOptions.find((s) => s.key === params.season) ??
    seasonOptions.find((s) => s.isActive) ??
    seasonOptions[0] ??
    null;
  const selectedSeasonKey = selectedSeason?.key ?? "";

  const todayAgendaItems = dash.todayEvents.map((ev) => ({
    time: formatTime(ev.startAt, fmtCfg),
    title: ev.title,
    type: mapEventType(ev.type),
    location: ev.location ?? undefined,
  }));

  const hasActionItems =
    dash.openRegistrationCount > 0 ||
    dash.newsInReviewCount > 0 ||
    dash.pagesInReviewCount > 0 ||
    dash.scheduledNewsCount > 0;

  const hasMeetings = dash.upcomingMeetings.length > 0;
  const hasInitiatives = dash.activeInitiativeCount > 0;

  const hasWebsiteContent =
    dash.draftNewsCount +
      dash.publishedNewsCount +
      dash.newsInReviewCount +
      dash.scheduledNewsCount +
      dash.draftPagesCount +
      dash.publishedPagesCount +
      dash.pagesInReviewCount >
    0;

  return (
    <PageShell fullWidth>
      <div className="space-y-8">

        {/* ── Welcome Area ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <PageHeader
            eyebrow="Dashboard"
            title={clubName}
            description={[
              currentSeasonLabel ? `Saison ${currentSeasonLabel}` : null,
              todayLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
            className="mb-0"
          />
        </div>

        {/* ── Action Center ──────────────────────────────────────────────── */}
        <section>
          <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Handlungsbedarf
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DashboardActionTile
              href="/dashboard/registrations"
              label="Offene Anmeldungen"
              count={dash.openRegistrationCount}
              subtext="Neu & In Bearbeitung"
              icon={<Inbox className="h-4 w-4" />}
              urgent
            />
            <DashboardActionTile
              href="/dashboard/website/news"
              label="News in Review"
              count={dash.newsInReviewCount}
              subtext="Warten auf Freigabe"
              icon={<Newspaper className="h-4 w-4" />}
              urgent
            />
            <DashboardActionTile
              href="/dashboard/website/pages"
              label="Seiten in Review"
              count={dash.pagesInReviewCount}
              subtext="Warten auf Freigabe"
              icon={<FileText className="h-4 w-4" />}
              urgent
            />
            <DashboardActionTile
              href="/dashboard/website/publishing"
              label="Geplante News"
              count={dash.scheduledNewsCount}
              subtext="Veröffentlichung ausstehend"
              icon={<ClipboardList className="h-4 w-4" />}
            />
          </div>
        </section>

        {/* ── Mains grid: Today + Meetings ───────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* Today's Operations — DashboardTodayAgenda has its own card shell */}
          <DashboardTodayAgenda items={todayAgendaItems} date={todayLabel} />

          {/* Meetings & Initiatives */}
          <div className="flex flex-col gap-6">

            {/* Upcoming Meetings */}
            <SectionCard
              title="Meetings"
              headerActions={
                <Link
                  href="/vereinsleitung/meetings"
                  className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Alle
                </Link>
              }
            >
              {hasMeetings ? (
                <ul className="space-y-2">
                  {dash.upcomingMeetings.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/vereinsleitung/meetings/${m.slug}`}
                        className="group flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">
                            {m.title}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {formatDate(m.meetingDate, fmtCfg)}
                            {m.location ? ` · ${m.location}` : ""}
                          </p>
                        </div>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<ScrollText className="h-7 w-7" />}
                  heading="Keine Meetings geplant"
                  description="Alle anstehenden Meetings erscheinen hier."
                  className="py-8"
                />
              )}
            </SectionCard>

            {/* Initiatives */}
            <SectionCard title="Initiativen">
              {hasInitiatives ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                      {dash.activeInitiativeCount}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-2)]">
                      Aktive Initiativen
                    </p>
                  </div>
                  <Link
                    href="/vereinsleitung/initiativen"
                    className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Ansehen
                  </Link>
                </div>
              ) : (
                <EmptyState
                  icon={<Flag className="h-7 w-7" />}
                  heading="Keine aktiven Initiativen"
                  className="py-8"
                />
              )}
            </SectionCard>

          </div>
        </div>

        {/* ── Website Activity ───────────────────────────────────────────── */}
        <SectionCard
          title="Website Aktivität"
          description="Übersicht über den aktuellen Redaktionsstand."
          headerActions={
            <Link
              href="/dashboard/website/publishing"
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <Globe className="h-3.5 w-3.5" />
              Publishing Center
            </Link>
          }
        >
          {hasWebsiteContent ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {/* News */}
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  <Newspaper className="h-3.5 w-3.5" />
                  News
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Entwürfe", count: dash.draftNewsCount, href: "/dashboard/website/news" },
                    { label: "In Review", count: dash.newsInReviewCount, href: "/dashboard/website/news" },
                    { label: "Geplant", count: dash.scheduledNewsCount, href: "/dashboard/website/publishing" },
                    { label: "Publiziert", count: dash.publishedNewsCount, href: "/dashboard/website/news" },
                  ].map(({ label, count, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="group flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition hover:bg-[var(--surface-2)]"
                    >
                      <span className="text-sm text-[var(--text-2)] group-hover:text-[var(--foreground)]">
                        {label}
                      </span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {count}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Pages */}
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  <FileText className="h-3.5 w-3.5" />
                  Seiten
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Entwürfe", count: dash.draftPagesCount, href: "/dashboard/website/pages" },
                    { label: "In Review", count: dash.pagesInReviewCount, href: "/dashboard/website/pages" },
                    { label: "Publiziert", count: dash.publishedPagesCount, href: "/dashboard/website/pages" },
                  ].map(({ label, count, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="group flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition hover:bg-[var(--surface-2)]"
                    >
                      <span className="text-sm text-[var(--text-2)] group-hover:text-[var(--foreground)]">
                        {label}
                      </span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {count}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Globe className="h-7 w-7" />}
              heading="Noch keine Website-Inhalte"
              description="Erstelle News, Seiten oder Mediendateien, um die Aktivität hier zu sehen."
              action={
                <Link
                  href="/dashboard/website/news/new"
                  className="fca-button-primary inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  News erstellen
                </Link>
              }
            />
          )}
        </SectionCard>

        {/* ── Quick Actions ──────────────────────────────────────────────── */}
        <SectionCard title="Schnellzugriff">
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/dashboard/website/news/new", label: "News erstellen", icon: <Newspaper className="h-3.5 w-3.5" /> },
              { href: "/dashboard/website/pages/new", label: "Seite erstellen", icon: <FileText className="h-3.5 w-3.5" /> },
              { href: "/dashboard/registrations", label: "Anmeldungen", icon: <Inbox className="h-3.5 w-3.5" /> },
              { href: `/dashboard/planner${selectedSeasonKey ? `?season=${encodeURIComponent(selectedSeasonKey)}` : ""}`, label: "Planner öffnen", icon: <ClipboardList className="h-3.5 w-3.5" /> },
              { href: "/dashboard/website/publishing", label: "Publishing Center", icon: <Globe className="h-3.5 w-3.5" /> },
              { href: "/vereinsleitung/meetings/new", label: "Meeting erstellen", icon: <ScrollText className="h-3.5 w-3.5" /> },
              { href: "/vereinsleitung/initiativen", label: "Initiativen", icon: <Flag className="h-3.5 w-3.5" /> },
              { href: "/dashboard/infoboard", label: "Infoboard", icon: <CalendarClock className="h-3.5 w-3.5" /> },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-2)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                {icon}
                {label}
              </Link>
            ))}
          </div>
        </SectionCard>

        {/* ── Season context ─────────────────────────────────────────────── */}
        {seasonOptions.length > 0 && (
          <SeasonContextSelector
            title="Aktive Saison"
            description="Dieser Kontext wird für saisongeführte Module wie Planner, Teams und Events verwendet."
            seasons={seasonOptions}
            selectedSeasonKey={selectedSeasonKey}
            basePath="/dashboard"
          />
        )}

        {/* ── Org KPIs ───────────────────────────────────────────────────── */}
        <section>
          <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Organisation
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard
              label="Saisons"
              value={String(dash.seasonCount)}
              subtext={
                currentSeasonLabel
                  ? `Aktiv: ${currentSeasonLabel}`
                  : selectedSeason
                  ? `Zuletzt: ${selectedSeason.name}`
                  : "Keine Saison konfiguriert"
              }
              icon={<CalendarRange className="h-4 w-4" />}
              trend="neutral"
            />
            <KpiCard
              label="Teams"
              value={String(dash.teamCount)}
              subtext="Alle Saisons gesamt"
              icon={<Users className="h-4 w-4" />}
              trend="neutral"
            />
            <KpiCard
              label="Personen"
              value={String(dash.personCount)}
              subtext="Registrierte Stammdaten"
              icon={<UserCircle2 className="h-4 w-4" />}
              trend="neutral"
            />
          </div>
        </section>

      </div>
    </PageShell>
  );
}
