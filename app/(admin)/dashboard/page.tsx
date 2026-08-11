import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  CheckSquare,
  FileText,
  Globe,
  Monitor,
  Newspaper,
  ScrollText,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { formatTime } from "@/lib/tenant-runtime/formatters";
import { getPersonalizedGreeting, resolveDashboardFirstName } from "@/lib/dashboard/greeting";
import { getPersonFirstNameByUserId } from "@/lib/people/queries";
import {
  DashboardHero,
  DashboardKpiCard,
  DashboardQuickActions,
  DashboardActivityFeed,
  DashboardActivityItem,
  DashboardSection,
  DashboardGrid,
  DashboardEmptyState,
} from "@/components/ui/dashboard";
import { getCurrentSwissFootballSeason } from "@/lib/seasons/season-logic";

// ── Types ─────────────────────────────────────────────────────────────────────

type DashboardPageProps = {
  searchParams?: Promise<{ season?: string }>;
};

// ── Activity helpers ──────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `Vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  return `Vor ${diffD} Tag${diffD === 1 ? "" : "en"}`;
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function getDashboardData(tenantId: string | null) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Week boundaries (Mon–Sun)
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() + daysToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const tWhere = tenantId ? { tenantId } : {};

  const [
    openRegistrationCount,
    newsInReviewCount,
    scheduledNewsCount,
    weekEventsCount,
    todayEventsCount,
    recentNews,
    recentRegistrations,
    recentEvents,
    recentMeetings,
    upcomingMeetings,
    upcomingEvents,
  ] = await Promise.all([
    prisma.registration.count({ where: { ...tWhere, status: { in: ["NEW", "REVIEWING"] } } }),
    prisma.newsArticle.count({ where: { ...tWhere, status: "IN_REVIEW" } }),
    prisma.newsArticle.count({ where: { ...tWhere, status: "SCHEDULED" } }),
    prisma.event.count({ where: { startAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.event.count({ where: { startAt: { gte: todayStart, lt: todayEnd } } }),

    // Activity feed sources
    prisma.newsArticle.findMany({
      where: tWhere,
      orderBy: { updatedAt: "desc" },
      take: 2,
      select: { id: true, title: true, updatedAt: true, status: true, authorName: true },
    }),
    prisma.registration.findMany({
      where: tWhere,
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { id: true, firstName: true, lastName: true, createdAt: true, type: true },
    }),
    prisma.event.findMany({
      where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { updatedAt: "desc" },
      take: 1,
      select: { id: true, title: true, updatedAt: true, type: true },
    }),
    prisma.meeting.findMany({
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { id: true, title: true, createdAt: true, slug: true },
    }),

    // Right sidebar — upcoming meetings
    prisma.meeting.findMany({
      where: { meetingDate: { gte: today }, status: "PLANNED" },
      orderBy: { meetingDate: "asc" },
      take: 3,
      select: { id: true, slug: true, title: true, meetingDate: true, location: true },
    }),

    // Right sidebar — upcoming sport events
    prisma.event.findMany({
      where: { startAt: { gte: todayStart } },
      orderBy: { startAt: "asc" },
      take: 4,
      select: { id: true, title: true, startAt: true, location: true, type: true },
    }),
  ]);

  return {
    openRegistrationCount,
    newsInReviewCount,
    scheduledNewsCount,
    weekEventsCount,
    todayEventsCount,
    recentNews,
    recentRegistrations,
    recentEvents,
    recentMeetings,
    upcomingMeetings,
    upcomingEvents,
  };
}

// ── Inline sub-components (page-specific) ─────────────────────────────────────

type TaskItemProps = {
  title: string;
  subtitle: string;
  dueLabel: string;
  urgent?: boolean;
};

function TaskItem({ title, subtitle, dueLabel, urgent = false }: TaskItemProps) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border-strong)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-medium leading-tight text-[var(--foreground)]">
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-2)]">{subtitle}</p>
      </div>
      <span
        className="shrink-0 text-xs font-semibold"
        style={{
          color: urgent ? "var(--sce-warning)" : "var(--muted)",
        }}
      >
        {dueLabel}
      </span>
    </div>
  );
}

type EventItemProps = {
  day: string;
  month: string;
  title: string;
  location: string;
  time: string;
};

function EventItem({ day, month, title, location, time }: EventItemProps) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)]">
        <span className="text-sm font-bold leading-none text-[var(--foreground)]">{day}</span>
        <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--text-2)]">
          {month}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8125rem] font-semibold leading-tight text-[var(--foreground)]">
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-2)]">{location}</p>
      </div>
      <span className="shrink-0 text-xs font-medium text-[var(--text-2)]">{time}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams: _sp }: DashboardPageProps) {
  const session = await auth();
  const ctx = await getActiveTenant();

  // DASHBOARD-SHELL-UX-01-C1: prefer the canonically linked Person's first
  // name over session.user.firstName (the raw User.firstName column), which
  // for some bootstrapped tenant accounts holds the club name instead of a
  // person's name. See lib/dashboard/greeting.ts for the resolution rule.
  const linkedPersonFirstName = session?.user?.id
    ? await getPersonFirstNameByUserId(session.user.id)
    : null;
  const firstName = resolveDashboardFirstName({
    linkedPersonFirstName,
    sessionFirstName: session?.user?.firstName,
    tenantName: ctx?.name,
  });

  const dash = await getDashboardData(ctx?.id ?? null);

  const fmtCfg = { locale: ctx?.locale ?? "de-CH", timezone: ctx?.timezone ?? undefined };

  // ── Presentation helpers ──────────────────────────────────────────────────

  const activeSeason = ctx
    ? getCurrentSwissFootballSeason()?.label
    : undefined;

  const todayFormatted = new Intl.DateTimeFormat(fmtCfg.locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date());

  // ── Activity feed ────────────────────────────────────────────────────────

  type ActivityEntry = {
    key: string;
    icon: React.ReactNode;
    iconAccent: DashboardActivityItem["iconAccent"];
    title: string;
    subtitle: string;
    date: Date;
    tag: string;
    tagVariant: DashboardActivityItem["tagVariant"];
  };

  const rawActivities: ActivityEntry[] = [
    ...dash.recentNews.map((n) => ({
      key: `news-${n.id}`,
      icon: <Newspaper className="h-4 w-4" />,
      iconAccent: "info" as const,
      title: n.title,
      subtitle: n.authorName ? `von ${n.authorName}` : "Newsartikel",
      date: n.updatedAt,
      tag: "News",
      tagVariant: "info" as const,
    })),
    ...dash.recentRegistrations.map((r) => ({
      key: `reg-${r.id}`,
      icon: <Users className="h-4 w-4" />,
      iconAccent: "warning" as const,
      title: `Neue Anmeldung von ${r.firstName} ${r.lastName}`,
      subtitle: r.type === "PROBETRAINING" ? "Probetraining" : "Spieleranmeldung",
      date: r.createdAt,
      tag: "Anmeldung",
      tagVariant: "warning" as const,
    })),
    ...dash.recentEvents.map((e) => ({
      key: `event-${e.id}`,
      icon: <CalendarDays className="h-4 w-4" />,
      iconAccent: "success" as const,
      title: `${e.title} wurde aktualisiert`,
      subtitle: e.type === "TRAINING" ? "Training" : e.type === "MATCH" ? "Spiel" : "Event",
      date: e.updatedAt,
      tag: "Planung",
      tagVariant: "success" as const,
    })),
    ...dash.recentMeetings.map((m) => ({
      key: `meeting-${m.id}`,
      icon: <ScrollText className="h-4 w-4" />,
      iconAccent: "primary" as const,
      title: `Meeting "${m.title}" erstellt`,
      subtitle: "Neues Meeting geplant",
      date: m.createdAt,
      tag: "Meeting",
      tagVariant: "primary" as const,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  const activityItems: DashboardActivityItem[] = rawActivities.map((a) => ({
    key: a.key,
    icon: a.icon,
    iconAccent: a.iconAccent,
    title: a.title,
    subtitle: a.subtitle,
    timestamp: timeAgo(a.date),
    tag: a.tag,
    tagVariant: a.tagVariant,
  }));

  // ── Tasks panel ──────────────────────────────────────────────────────────

  const tasks: { title: string; subtitle: string; dueLabel: string; urgent: boolean }[] = [];
  if (dash.newsInReviewCount > 0) {
    tasks.push({
      title: `Newsartikel prüfen (${dash.newsInReviewCount})`,
      subtitle: `${dash.newsInReviewCount > 1 ? "Mehrere Artikel" : "1 Artikel"} warten auf Freigabe`,
      dueLabel: "Heute",
      urgent: true,
    });
  }
  if (dash.openRegistrationCount > 0) {
    tasks.push({
      title: `Anmeldungen bestätigen (${dash.openRegistrationCount})`,
      subtitle: "Neue Anmeldungen prüfen",
      dueLabel: "Heute",
      urgent: true,
    });
  }
  if (dash.scheduledNewsCount > 0) {
    tasks.push({
      title: "Veröffentlichungen freigeben",
      subtitle: `${dash.scheduledNewsCount} geplante Artikel`,
      dueLabel: "Diese Woche",
      urgent: false,
    });
  }
  // Filler tasks to show at least some items
  if (tasks.length === 0) {
    tasks.push(
      {
        title: "Homepage überprüfen",
        subtitle: "Aktuelle Inhalte validieren",
        dueLabel: "Morgen",
        urgent: false,
      },
      {
        title: "Saisonplanung aktualisieren",
        subtitle: "Events für nächste Woche eintragen",
        dueLabel: "12.06.",
        urgent: false,
      },
    );
  }

  // ── Upcoming events (merge sport events + meetings) ───────────────────────

  type UpcomingEntry = {
    key: string;
    day: string;
    month: string;
    title: string;
    location: string;
    time: string;
  };

  const MONTHS_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  const upcomingEntries: UpcomingEntry[] = [
    ...dash.upcomingEvents.map((ev) => ({
      key: `ev-${ev.id}`,
      day: String(ev.startAt.getDate()),
      month: MONTHS_DE[ev.startAt.getMonth()] ?? "",
      title: ev.title,
      location: ev.location ?? (ev.type === "TRAINING" ? "Sportanlage" : ""),
      time: formatTime(ev.startAt, fmtCfg),
    })),
    ...dash.upcomingMeetings.map((m) => ({
      key: `mt-${m.id}`,
      day: String(m.meetingDate.getDate()),
      month: MONTHS_DE[m.meetingDate.getMonth()] ?? "",
      title: m.title,
      location: m.location ?? "Sitzungszimmer",
      time: formatTime(m.meetingDate, fmtCfg),
    })),
  ]
    .sort((a, b) => {
      const dateA = dash.upcomingEvents.find((e) => `ev-${e.id}` === a.key)?.startAt
        ?? dash.upcomingMeetings.find((m) => `mt-${m.id}` === a.key)?.meetingDate
        ?? new Date();
      const dateB = dash.upcomingEvents.find((e) => `ev-${e.id}` === b.key)?.startAt
        ?? dash.upcomingMeetings.find((m) => `mt-${m.id}` === b.key)?.meetingDate
        ?? new Date();
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 4);

  const greeting = getPersonalizedGreeting(firstName);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <DashboardHero
        greeting={greeting}
        subtitle="Schön, dich wiederzusehen."
        clubName={ctx?.name ?? undefined}
        activeSeason={activeSeason}
        date={todayFormatted}
      />

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DashboardKpiCard
          title="Offene Anmeldungen"
          value={String(dash.openRegistrationCount)}
          description="+3 seit gestern"
          accent="warning"
          icon={<Users className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="News in Prüfung"
          value={String(dash.newsInReviewCount)}
          description="2 fällig heute"
          accent="info"
          icon={<Newspaper className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Veröffentlichungen geplant"
          value={String(dash.scheduledNewsCount)}
          description="Diese Woche"
          accent="success"
          icon={<Monitor className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Events diese Woche"
          value={String(dash.weekEventsCount)}
          description={`${dash.todayEventsCount} heute`}
          accent="primary"
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>

      {/* ── Main content + sidebar ────────────────────────────────────────── */}
      <DashboardGrid
        sidebar={
          <>
            {/* Meine Aufgaben */}
            <DashboardSection
              title="Meine Aufgaben"
              actions={<CheckSquare className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />}
              noPadding
              footer={
                <Link href="/dashboard/registrations" className="sce-link-primary text-[0.8125rem]">
                  Alle Aufgaben anzeigen →
                </Link>
              }
            >
              <div className="px-5 pt-1">
                {tasks.map((t, i) => (
                  <TaskItem
                    key={i}
                    title={t.title}
                    subtitle={t.subtitle}
                    dueLabel={t.dueLabel}
                    urgent={t.urgent}
                  />
                ))}
              </div>
            </DashboardSection>

            {/* Nächste Termine */}
            <DashboardSection
              title="Nächste Termine"
              actions={<CalendarDays className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />}
              noPadding
              footer={
                <Link href="/dashboard/events" className="sce-link-primary text-[0.8125rem]">
                  Alle Termine anzeigen →
                </Link>
              }
            >
              <div className="px-5 pt-1">
                {upcomingEntries.length > 0 ? (
                  upcomingEntries.map((e) => (
                    <EventItem
                      key={e.key}
                      day={e.day}
                      month={e.month}
                      title={e.title}
                      location={e.location}
                      time={e.time}
                    />
                  ))
                ) : (
                  <DashboardEmptyState
                    icon={<CalendarDays className="h-6 w-6" />}
                    title="Keine bevorstehenden Termine"
                    className="py-6"
                  />
                )}
              </div>
            </DashboardSection>
          </>
        }
      >
        {/* Schnellaktionen */}
        <DashboardSection title="Schnellaktionen" noPadding>
          <div className="p-4">
            <DashboardQuickActions
              actions={[
                {
                  href: "/dashboard/website/news/new",
                  icon: <Newspaper className="h-4 w-4" />,
                  title: "Neue News",
                  subtitle: "Artikel erstellen",
                  accent: "info",
                },
                {
                  href: "/dashboard/website/pages/new",
                  icon: <FileText className="h-4 w-4" />,
                  title: "Neue Seite",
                  subtitle: "Webseite erstellen",
                  accent: "primary",
                },
                {
                  href: "/dashboard/website/publishing",
                  icon: <Monitor className="h-4 w-4" />,
                  title: "Homepage",
                  subtitle: "Vorschau öffnen",
                  accent: "success",
                },
                {
                  href: "/dashboard/planner",
                  icon: <CalendarRange className="h-4 w-4" />,
                  title: "Wochenplanung",
                  subtitle: "Zur Planung",
                  accent: "warning",
                },
              ]}
            />
          </div>
        </DashboardSection>

        {/* Aktuelle Aktivitäten */}
        <DashboardSection
          title="Aktuelle Aktivitäten"
          noPadding
          footer={
            <Link href="/dashboard/logs" className="sce-link-primary text-[0.8125rem]">
              Alle Aktivitäten anzeigen →
            </Link>
          }
        >
          <div className="px-5 pt-1">
            <DashboardActivityFeed
              items={activityItems}
              emptyState={
                <DashboardEmptyState
                  icon={<Globe className="h-7 w-7" />}
                  title="Noch keine Aktivitäten"
                  description="Aktivitäten erscheinen hier sobald Inhalte erstellt werden."
                />
              }
            />
          </div>
        </DashboardSection>
      </DashboardGrid>
    </div>
  );
}
