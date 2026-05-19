import Link from "next/link";
import {
  Briefcase,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Shield,
  UserCircle2,
  UserRound,
  Users,
} from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { getSeasonOptionsData } from "@/lib/seasons/queries";

const DASHBOARD_MODULES = [
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
];

type DashboardPageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const seasonOptions = await getSeasonOptionsData();

  const selectedSeason =
    seasonOptions.find((season) => season.key === params.season) ??
    seasonOptions.find((season) => season.isActive) ??
    seasonOptions[0] ??
    null;

  const selectedSeasonKey = selectedSeason?.key ?? "";

  return (
    <div className="space-y-6">
      <section className="sce-card p-6 backdrop-blur-xl lg:p-7">
        <p className="sce-eyebrow">Dashboard</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[var(--sce-heading)] lg:text-[2.35rem]">
          Operations Cockpit
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-[var(--sce-muted)]">
          Saisons sind die führende Struktur des Workspaces. Teams, Events und Planner
          werden dynamisch pro Saison verwaltet und für die operative Steuerung verbunden.
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
          {DASHBOARD_MODULES.map((module) => {
            const Icon = module.icon;
            const href =
              selectedSeasonKey && module.carrySeason
                ? `${module.href}?season=${encodeURIComponent(selectedSeasonKey)}`
                : module.href;

            return (
              <Link
                key={module.href}
                href={href}
                className="group block rounded-[28px] border border-[var(--sce-border)] bg-[var(--sce-surface-muted)] p-6 shadow-sm transition hover:-translate-y-[2px] hover:shadow-[var(--sce-shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="sce-eyebrow">Modul</p>
                    <h3 className="mt-2 font-[var(--font-display)] text-[1.7rem] font-bold uppercase tracking-[-0.03em] text-[var(--sce-heading)]">
                      {module.title}
                    </h3>
                    <p className="mt-3 text-sm text-[var(--sce-muted)]">
                      {module.description}
                    </p>
                  </div>

                  <div className="sce-module-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-sm transition group-hover:scale-105">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </AdminSurfaceCard>
    </div>
  );
}
