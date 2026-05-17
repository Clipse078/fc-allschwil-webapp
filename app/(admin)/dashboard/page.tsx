import Link from "next/link";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Globe,
  InboxIcon,
  Shield,
  UserCircle2,
  UserRound,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { getSeasonOptionsData } from "@/lib/seasons/queries";

// Platform-level cards shown to superadmin
const PLATFORM_MODULES = [
  {
    title: "Tenants / Clubs",
    description:
      "Manage all registered clubs and organizations on this platform. Add new tenants and configure their access.",
    href: "/dashboard/users",
    icon: Building2,
    badge: "1 active",
  },
  {
    title: "Website Builder",
    description:
      "Configure and publish public-facing club websites. Manage content, layouts and branding per tenant.",
    href: "/dashboard",
    icon: Globe,
    badge: "Coming soon",
  },
  {
    title: "Inquiries",
    description:
      "Review contact form submissions, membership inquiries and onboarding requests across all clubs.",
    href: "/dashboard",
    icon: InboxIcon,
    badge: "Coming soon",
  },
  {
    title: "Users & Roles",
    description:
      "Manage platform users, roles and permissions. Control who has access to which modules and tenants.",
    href: "/dashboard/users",
    icon: Shield,
    badge: null,
  },
  {
    title: "Seasons & Planning",
    description:
      "Platform-wide season calendar, planning cycles and scheduling configuration across all clubs.",
    href: "/dashboard/seasons",
    icon: CalendarRange,
    badge: null,
  },
  {
    title: "System Health",
    description:
      "Monitor platform status, database health, job queues and error rates across all services.",
    href: "/dashboard",
    icon: AlertCircle,
    badge: "Coming soon",
  },
] as const;

// Club-level operational modules for FC Allschwil tenant
const CLUB_MODULES = [
  {
    title: "Vereinsleitung",
    description:
      "Strategische Steuerung des Vereins mit Meetings, Initiativen, KPIs und Entscheidungen.",
    href: "/vereinsleitung",
    icon: Briefcase,
    carrySeason: false,
  },
  {
    title: "Saisons",
    description:
      "Saisons sind die führende Struktur. Von hier aus werden Teams, Events und Planner pro Saison aufgebaut.",
    href: "/dashboard/seasons",
    icon: CalendarRange,
    carrySeason: true,
  },
  {
    title: "Saisonplanner",
    description:
      "Gesamte Saisonagenda mit Trainings, Matches, Turnieren, weiteren Events und Ferienperioden.",
    href: "/dashboard/planner",
    icon: ClipboardList,
    carrySeason: true,
  },
  {
    title: "Teams",
    description:
      "Teams sind saisongeführt und werden dynamisch pro Saison und Teamkategorie verwaltet.",
    href: "/dashboard/teams",
    icon: Users,
    carrySeason: true,
  },
  {
    title: "Events",
    description:
      "Events sind saisongeführt und umfassen Matches, Turniere, Trainings und weitere Vereinsereignisse.",
    href: "/dashboard/events",
    icon: CalendarDays,
    carrySeason: true,
  },
  {
    title: "Personen",
    description:
      "Personenstammdaten als Basis für Spieler, Trainer und weitere Rollen pflegen.",
    href: "/dashboard/persons",
    icon: UserCircle2,
    carrySeason: false,
  },
  {
    title: "Spieler & Trainer",
    description:
      "Spieler- und Trainerbereiche strukturiert aufbauen und für saisongeführte Prozesse vorbereiten.",
    href: "/dashboard/players",
    icon: UserRound,
    carrySeason: false,
  },
  {
    title: "Benutzer",
    description:
      "Benutzer, Rollen und Berechtigungen für die WebApp zentral verwalten.",
    href: "/dashboard/users",
    icon: Shield,
    carrySeason: false,
  },
] as const;

type DashboardPageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const [rawParams, session] = await Promise.all([
    searchParams ?? Promise.resolve({}),
    auth(),
  ]);

  const activeTenantId = session?.user?.activeTenantId ?? "";
  const seasonOptions = await getSeasonOptionsData(activeTenantId || undefined);

  const params = rawParams as { season?: string };

  const isSuperAdmin = session?.user?.roleKeys?.includes("super_admin") ?? false;

  const selectedSeason =
    seasonOptions.find((season) => season.key === params.season) ??
    seasonOptions.find((season) => season.isActive) ??
    seasonOptions[0] ??
    null;

  const selectedSeasonKey = selectedSeason?.key ?? "";

  return (
    <div className="space-y-6">
      {/* Platform overview — superadmin only */}
      {isSuperAdmin ? (
        <>
          {/* Superadmin identity banner */}
          <section className="rounded-[32px] border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50/60 p-6 shadow-sm lg:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-green-600">
                  SportClubEvo Platform
                </p>
                <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-slate-900 lg:text-[2.35rem]">
                  Platform Overview
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  You are logged in as Superadmin. Manage tenants, platform settings and
                  system health from this view. FC Allschwil operational modules are
                  available below.
                </p>
                <p className="mt-2 max-w-2xl text-xs text-green-700">
                  Tenant scoping is active. Existing FC Allschwil data has been assigned to
                  the FC Allschwil tenant. Run{" "}
                  <code className="rounded bg-green-100 px-1 py-0.5 font-mono">
                    npm run backfill:tenant:fca
                  </code>{" "}
                  once to backfill any legacy rows.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl border border-green-200 bg-white px-5 py-3 shadow-sm">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-green-600">
                  Role
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Superadmin</p>
              </div>
            </div>
          </section>

          <AdminSurfaceCard className="p-6">
            <p className="mb-5 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-slate-500">
              Platform Modules
            </p>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {PLATFORM_MODULES.map((module) => {
                const Icon = module.icon;

                return (
                  <Link
                    key={module.title}
                    href={module.href}
                    className="group block rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm transition hover:-translate-y-[2px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="fca-eyebrow">Platform</p>
                          {module.badge ? (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-500">
                              {module.badge}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 font-[var(--font-display)] text-[1.55rem] font-bold uppercase tracking-[-0.03em] text-[#0b4aa2]">
                          {module.title}
                        </h3>
                        <p className="mt-3 text-sm text-slate-600">{module.description}</p>
                      </div>

                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm transition group-hover:scale-105">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </AdminSurfaceCard>

          {/* Divider between platform and tenant sections */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 shadow-sm">
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Tenant: FC Allschwil
              </span>
            </div>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      ) : null}

      {/* Club operational section header */}
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:p-7">
        <p className="fca-eyebrow">FC Allschwil</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2] lg:text-[2.35rem]">
          {isSuperAdmin ? "Club Modules" : "Saisongeführte Modulübersicht"}
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          {isSuperAdmin
            ? "Operational modules for FC Allschwil. Seasons are the leading structure — teams, events and planners are managed per season."
            : "Saisons sind die führende Struktur dieser WebApp. Teams, Events und Planner werden dynamisch pro Saison verwaltet und darauf aufgebaut."}
        </p>
      </section>

      <SeasonContextSelector
        title="Aktive Saison"
        description="Diese Auswahl wird als Kontext für saisongeführte Module wie Saisonplanner, Teams, Events und später weitere Planer verwendet."
        seasons={seasonOptions}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard"
      />

      <AdminSurfaceCard className="p-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {CLUB_MODULES.map((module) => {
            const Icon = module.icon;
            const href =
              selectedSeasonKey && module.carrySeason
                ? `${module.href}?season=${encodeURIComponent(selectedSeasonKey)}`
                : module.href;

            return (
              <Link
                key={module.href}
                href={href}
                className="group block rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm transition hover:-translate-y-[2px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="fca-eyebrow">Modul</p>
                    <h3 className="mt-2 font-[var(--font-display)] text-[1.7rem] font-bold uppercase tracking-[-0.03em] text-[#0b4aa2]">
                      {module.title}
                    </h3>
                    <p className="mt-3 text-sm text-slate-600">{module.description}</p>
                  </div>

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm transition group-hover:scale-105">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </AdminSurfaceCard>

      {/* Periodic review nudge */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">
          Note
        </p>
        <p className="mt-1 text-sm text-amber-900">
          This dashboard should be reviewed periodically as modules are added.
        </p>
      </div>
    </div>
  );
}
