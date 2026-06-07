import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Settings2,
  UserCircle2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { KpiCard } from "@/components/admin/dashboard/KpiCard";
import DashboardTodayAgenda from "@/components/admin/dashboard/DashboardTodayAgenda";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/cn";
import { MODULE_DEFINITIONS, type ModuleDefinition } from "@/lib/nav/nav-config";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { auth } from "@/auth";
import { formatTime, formatTodayDate, getCurrentSeasonLabel } from "@/lib/tenant-runtime/formatters";

// Icon map for dashboard module cards — keyed on ModuleDefinition.key
const MODULE_ICONS: Record<string, LucideIcon> = {
  admin:          Settings2,
  vereinsleitung: Briefcase,
  seasons:        CalendarRange,
  saisonplanner:  ClipboardList,
  teams:          Users,
  events:         CalendarDays,
  personen:       UserCircle2,
};

type DashboardPageProps = {
  searchParams?: Promise<{ season?: string }>;
};

async function getDashboardKpiData() {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [seasonCount, teamCount, personCount, todayEvents] = await Promise.all([
    prisma.season.count(),
    prisma.team.count(),
    prisma.person.count(),
    prisma.event.findMany({
      where: {
        startAt: { gte: todayStart, lt: todayEnd },
      },
      select: {
        id: true,
        title: true,
        type: true,
        startAt: true,
        location: true,
      },
      orderBy: { startAt: "asc" },
      take: 8,
    }),
  ]);

  return { seasonCount, teamCount, personCount, todayEvents };
}


function mapEventType(type: string): "training" | "match" | "meeting" | "other" {
  if (type === "TRAINING") return "training";
  if (type === "MATCH") return "match";
  return "other";
}

function ModuleCard({
  module,
  href,
}: {
  module: ModuleDefinition;
  href: string;
}) {
  const Icon = MODULE_ICONS[module.key] ?? Briefcase;
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]",
        "p-5 shadow-[var(--shadow-xs)] transition-all duration-150",
        "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] transition-transform duration-150 group-hover:scale-105"
          style={{
            background: "var(--tenant-accent)",
            color: "var(--tenant-primary)",
          }}
        >
          <Icon style={{ width: 18, height: 18 }} />
        </div>
        <ArrowRight
          className="h-4 w-4 text-[var(--muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 mt-1"
        />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {module.label}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">
          {module.description}
        </p>
      </div>
    </Link>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const session = await auth();
  const [seasonOptions, kpiData, ctx] = await Promise.all([
    getSeasonOptionsData(),
    getDashboardKpiData(),
    getTenantContextFromSession(session?.user?.tenantId),
  ]);

  const locale = ctx?.locale ?? "de-CH";
  const timezone = ctx?.timezone ?? undefined;
  const currentSeasonLabel = ctx ? getCurrentSeasonLabel(ctx) : null;

  const selectedSeason =
    seasonOptions.find((s) => s.key === params.season) ??
    seasonOptions.find((s) => s.isActive) ??
    seasonOptions[0] ??
    null;

  const selectedSeasonKey = selectedSeason?.key ?? "";

  const fmtCfg = { locale, timezone };
  const todayAgendaItems = kpiData.todayEvents.map((ev) => ({
    time: formatTime(ev.startAt, fmtCfg),
    title: ev.title,
    type: mapEventType(ev.type),
    location: ev.location ?? undefined,
  }));

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Saisons"
          value={String(kpiData.seasonCount)}
          subtext={
            currentSeasonLabel
              ? `Saison ${currentSeasonLabel}`
              : selectedSeason
              ? `Aktiv: ${selectedSeason.name}`
              : "Keine aktive Saison"
          }
          trend="neutral"
        />
        <KpiCard
          label="Teams"
          value={String(kpiData.teamCount)}
          subtext="Alle Saisons gesamt"
          trend="neutral"
        />
        <KpiCard
          label="Personen"
          value={String(kpiData.personCount)}
          subtext="Registrierte Stammdaten"
          trend="neutral"
        />
        <KpiCard
          label="Heute"
          value={String(kpiData.todayEvents.length)}
          subtext={kpiData.todayEvents.length === 1 ? "Event heute" : "Events heute"}
          trend="neutral"
        />
      </div>

      {/* ── Season context + Today agenda ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Season selector */}
        <div>
          <SeasonContextSelector
            title="Aktive Saison"
            description="Dieser Kontext wird für saisongeführte Module wie Planner, Teams und Events verwendet."
            seasons={seasonOptions}
            selectedSeasonKey={selectedSeasonKey}
            basePath="/dashboard"
          />
        </div>

        {/* Today agenda */}
        <DashboardTodayAgenda
          items={todayAgendaItems}
          date={formatTodayDate(fmtCfg)}
        />
      </div>

      {/* ── Module cards ──────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Module
            </p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[var(--foreground)]">
              Alle Bereiche
            </h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {MODULE_DEFINITIONS.map((module) => {
            const href =
              selectedSeasonKey && module.carrySeason
                ? `${module.href}?season=${encodeURIComponent(selectedSeasonKey)}`
                : module.href;

            return (
              <ModuleCard key={module.key} module={module} href={href} />
            );
          })}
        </div>
      </section>
    </div>
  );
}
