import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  Layers,
  Monitor,
  Newspaper,
  Plus,
  ScrollText,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import {
  formatTime,
  formatDate,
} from "@/lib/tenant-runtime/formatters";
import { KpiCard } from "@/components/admin/dashboard/KpiCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type DashboardPageProps = {
  searchParams?: Promise<{ season?: string }>;
};

// ── Greeting ──────────────────────────────────────────────────────────────────

function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return `Good morning, ${firstName} 👋`;
  if (hour >= 12 && hour < 18) return `Good afternoon, ${firstName} 👋`;
  return `Good evening, ${firstName} 👋`;
}

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

// ── Sub-components ────────────────────────────────────────────────────────────

type QuickActionCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
};

function QuickActionCard({ href, icon, title, subtitle, iconBg, iconColor }: QuickActionCardProps) {
  return (
    <Link href={href} className="sce-quick-action-card">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[0.875rem] font-semibold text-[var(--foreground)] leading-tight">{title}</p>
        <p className="mt-0.5 text-[0.75rem] text-[var(--text-2)]">{subtitle}</p>
      </div>
    </Link>
  );
}

type ActivityItemProps = {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  time: string;
  tag: string;
  tagBg: string;
  tagColor: string;
};

function ActivityItem({
  icon, iconBg, iconColor, title, subtitle, time, tag, tagBg, tagColor,
}: ActivityItemProps) {
  return (
    <div className="sce-activity-item">
      <div
        className="sce-activity-icon"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.875rem] font-medium text-[var(--foreground)]">{title}</p>
        <p className="mt-0.5 truncate text-[0.75rem] text-[var(--text-2)]">{subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[0.72rem] text-[var(--muted)]">{time}</span>
        <span
          className="sce-tag-pill"
          style={{ background: tagBg, color: tagColor }}
        >
          {tag}
        </span>
      </div>
    </div>
  );
}

type TaskItemProps = {
  title: string;
  subtitle: string;
  dueLabel: string;
  urgent?: boolean;
};

function TaskItem({ title, subtitle, dueLabel, urgent = false }: TaskItemProps) {
  return (
    <div className="sce-task-item">
      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#D1D5DB]" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-medium text-[var(--foreground)] leading-tight">{title}</p>
        <p className="mt-0.5 text-[0.72rem] text-[var(--text-2)] truncate">{subtitle}</p>
      </div>
      <span
        className="shrink-0 text-[0.72rem] font-semibold"
        style={{ color: urgent ? "#FF6A00" : "#9CA3AF" }}
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
    <div className="sce-event-item">
      <div className="sce-date-chip">
        <span className="text-[0.875rem] font-bold leading-none text-[var(--foreground)]">{day}</span>
        <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--text-2)]">{month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8125rem] font-semibold text-[var(--foreground)] leading-tight">{title}</p>
        <p className="mt-0.5 truncate text-[0.72rem] text-[var(--text-2)]">{location}</p>
      </div>
      <span className="shrink-0 text-[0.75rem] font-medium text-[var(--text-2)]">{time}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams: _sp }: DashboardPageProps) {
  const session = await auth();
  const tenantId = session?.user?.tenantId ?? null;
  const firstName = session?.user?.firstName ?? "Admin";

  const [dash, ctx] = await Promise.all([
    getDashboardData(tenantId),
    getTenantContextFromSession(tenantId),
  ]);

  const fmtCfg = { locale: ctx?.locale ?? "de-CH", timezone: ctx?.timezone ?? undefined };

  // ── Activity feed ────────────────────────────────────────────────────────

  type ActivityEntry = {
    key: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    title: string;
    subtitle: string;
    date: Date;
    tag: string;
    tagBg: string;
    tagColor: string;
  };

  const activities: ActivityEntry[] = [
    ...dash.recentNews.map((n) => ({
      key: `news-${n.id}`,
      icon: <Newspaper className="h-4 w-4" />,
      iconBg: "rgba(59,130,246,0.10)",
      iconColor: "#3B82F6",
      title: n.title,
      subtitle: n.authorName ? `von ${n.authorName}` : "Newsartikel",
      date: n.updatedAt,
      tag: "News",
      tagBg: "rgba(59,130,246,0.10)",
      tagColor: "#3B82F6",
    })),
    ...dash.recentRegistrations.map((r) => ({
      key: `reg-${r.id}`,
      icon: <Users className="h-4 w-4" />,
      iconBg: "rgba(255,106,0,0.10)",
      iconColor: "#FF6A00",
      title: `Neue Anmeldung von ${r.firstName} ${r.lastName}`,
      subtitle: r.type === "PROBETRAINING" ? "Probetraining" : "Spieleranmeldung",
      date: r.createdAt,
      tag: "Anmeldung",
      tagBg: "rgba(255,106,0,0.10)",
      tagColor: "#FF6A00",
    })),
    ...dash.recentEvents.map((e) => ({
      key: `event-${e.id}`,
      icon: <CalendarDays className="h-4 w-4" />,
      iconBg: "rgba(16,185,129,0.10)",
      iconColor: "#10B981",
      title: `${e.title} wurde aktualisiert`,
      subtitle: e.type === "TRAINING" ? "Training" : e.type === "MATCH" ? "Spiel" : "Event",
      date: e.updatedAt,
      tag: "Planung",
      tagBg: "rgba(16,185,129,0.10)",
      tagColor: "#10B981",
    })),
    ...dash.recentMeetings.map((m) => ({
      key: `meeting-${m.id}`,
      icon: <ScrollText className="h-4 w-4" />,
      iconBg: "rgba(139,92,246,0.10)",
      iconColor: "#8B5CF6",
      title: `Meeting "${m.title}" erstellt`,
      subtitle: "Neues Meeting geplant",
      date: m.createdAt,
      tag: "Meeting",
      tagBg: "rgba(139,92,246,0.10)",
      tagColor: "#8B5CF6",
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

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

  const greeting = getGreeting(firstName);

  return (
    <div className="space-y-6">

      {/* ── Welcome Row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fca-heading">
            {greeting}
          </h1>
          <p className="fca-body-muted mt-1">
            Hier ist, was heute in deinem Verein ansteht.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-[0.8125rem] font-medium text-[var(--text-2)] shadow-sm transition hover:bg-[var(--surface-2)]"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard anpassen
          </button>
          <Link
            href="/dashboard/website/news/new"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[0.8125rem] font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #FF6A00 0%, #FF8533 100%)",
              boxShadow: "0 2px 8px rgba(255,106,0,0.25)",
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Schnellaktion
            <ChevronDown className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Offene Anmeldungen"
          value={String(dash.openRegistrationCount)}
          subtext="+3 seit gestern"
          accent="orange"
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          label="News in Prüfung"
          value={String(dash.newsInReviewCount)}
          subtext="2 fällig heute"
          accent="blue"
          icon={<Newspaper className="h-5 w-5" />}
        />
        <KpiCard
          label="Veröffentlichungen geplant"
          value={String(dash.scheduledNewsCount)}
          subtext="Diese Woche"
          accent="green"
          icon={<Layers className="h-5 w-5" />}
        />
        <KpiCard
          label="Events diese Woche"
          value={String(dash.weekEventsCount)}
          subtext={`${dash.todayEventsCount} heute`}
          accent="purple"
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>

      {/* ── Main content + right sidebar ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">

        {/* Left: Quick Actions + Activity Feed */}
        <div className="space-y-6">

          {/* Schnellaktionen */}
          <div className="sce-section-card-v3">
            <div className="sce-section-card-v3-header">
              <h2 className="sce-section-card-title">Schnellaktionen</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              <QuickActionCard
                href="/dashboard/website/news/new"
                icon={<Newspaper className="h-4.5 w-4.5" />}
                title="Neue News"
                subtitle="Artikel erstellen"
                iconBg="rgba(255,106,0,0.10)"
                iconColor="#FF6A00"
              />
              <QuickActionCard
                href="/dashboard/website/pages/new"
                icon={<FileText className="h-4.5 w-4.5" />}
                title="Neue Seite"
                subtitle="Webseite erstellen"
                iconBg="rgba(59,130,246,0.10)"
                iconColor="#3B82F6"
              />
              <QuickActionCard
                href="/dashboard/website/publishing"
                icon={<Monitor className="h-4.5 w-4.5" />}
                title="Homepage"
                subtitle="Vorschau öffnen"
                iconBg="rgba(16,185,129,0.10)"
                iconColor="#10B981"
              />
              <QuickActionCard
                href="/dashboard/planner"
                icon={<CalendarRange className="h-4.5 w-4.5" />}
                title="Wochenplanung"
                subtitle="Zur Planung"
                iconBg="rgba(139,92,246,0.10)"
                iconColor="#8B5CF6"
              />
            </div>
          </div>

          {/* Aktuelle Aktivitäten */}
          <div className="sce-section-card-v3">
            <div className="sce-section-card-v3-header">
              <h2 className="sce-section-card-title">Aktuelle Aktivitäten</h2>
            </div>
            <div className="sce-section-card-v3-body">
              {activities.length > 0 ? (
                activities.map((a) => (
                  <ActivityItem
                    key={a.key}
                    icon={a.icon}
                    iconBg={a.iconBg}
                    iconColor={a.iconColor}
                    title={a.title}
                    subtitle={a.subtitle}
                    time={timeAgo(a.date)}
                    tag={a.tag}
                    tagBg={a.tagBg}
                    tagColor={a.tagColor}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Globe className="h-7 w-7 text-[var(--muted)]" />
                  <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">Noch keine Aktivitäten</p>
                  <p className="text-sm text-[var(--text-2)]">Aktivitäten erscheinen hier sobald Inhalte erstellt werden.</p>
                </div>
              )}
            </div>
            <div className="sce-section-card-v3-footer">
              <Link
                href="/dashboard/logs"
                className="text-[0.8125rem] font-medium transition"
                style={{ color: "#FF6A00" }}
              >
                Alle Aktivitäten anzeigen →
              </Link>
            </div>
          </div>

        </div>

        {/* Right sidebar: Tasks + Events */}
        <div className="space-y-6">

          {/* Meine Aufgaben */}
          <div className="sce-section-card-v3">
            <div className="sce-section-card-v3-header">
              <h2 className="sce-section-card-title">Meine Aufgaben</h2>
              <CheckSquare className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <div className="sce-section-card-v3-body">
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
            <div className="sce-section-card-v3-footer">
              <Link
                href="/dashboard/registrations"
                className="text-[0.8125rem] font-medium transition"
                style={{ color: "#FF6A00" }}
              >
                Alle Aufgaben anzeigen →
              </Link>
            </div>
          </div>

          {/* Nächste Termine */}
          <div className="sce-section-card-v3">
            <div className="sce-section-card-v3-header">
              <h2 className="sce-section-card-title">Nächste Termine</h2>
              <CalendarDays className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <div className="sce-section-card-v3-body">
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
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CalendarDays className="h-6 w-6 text-[var(--muted)]" />
                  <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">Keine bevorstehenden Termine</p>
                </div>
              )}
            </div>
            <div className="sce-section-card-v3-footer">
              <Link
                href="/dashboard/events"
                className="text-[0.8125rem] font-medium transition"
                style={{ color: "#FF6A00" }}
              >
                Alle Termine anzeigen →
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
