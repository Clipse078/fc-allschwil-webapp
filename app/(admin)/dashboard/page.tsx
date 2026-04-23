import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  BriefcaseBusiness,
  CalendarRange,
  GraduationCap,
  Shield,
  UserCircle2,
  UserPlus,
} from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { getSeasonOptionsData } from "@/lib/seasons/queries";

const DASHBOARD_MODULES = [
  {
    number: "1",
    title: "Vereinsleitung",
    description:
      "Strategische Steuerung mit Meetings, Initiativen, Organigramm und künftigem Kommunikation HUB.",
    href: "/vereinsleitung",
    icon: Briefcase,
    carrySeason: false,
  },
  {
    number: "2",
    title: "Operations &\nOrganisation",
    description:
      "Demo-Modul mit Finanzen, Material, Media, Aktivitäten / Events, Business Club, Archiv, Meetings und Kommunikation HUB.",
    href: "/dashboard/operations",
    icon: BriefcaseBusiness,
    carrySeason: false,
  },
  {
    number: "3",
    title: "Technische\nKommission",
    description:
      "Demo-Modul mit Leistungsplan Aktive, Jugend-Ausbildungsplan, Meetings und Kommunikation HUB.",
    href: "/dashboard/technische-kommission",
    icon: GraduationCap,
    carrySeason: false,
  },
  {
    number: "4",
    title: "Aktuelle Saison",
    description:
      "Aktuelle Saison mit Teams, Planner, Jahresplan, Wochenplan und Tagesplan.",
    href: "/dashboard/current-season",
    icon: CalendarRange,
    carrySeason: true,
    seasonBadgeTone: "current",
  },
  {
    number: "5",
    title: "Nächste Saison",
    description:
      "Vorbereitung der kommenden Saison mit Teams, Planner, Jahresplan, Wochenplan und Tagesplan.",
    href: "/dashboard/next-season",
    icon: CalendarRange,
    carrySeason: false,
    seasonBadgeTone: "next",
  },
  {
    number: "6",
    title: "Persons",
    description:
      "Modul für Trainers, Players, Vereinsfunktionäre und External Contacts.",
    href: "/dashboard/persons",
    icon: UserCircle2,
    carrySeason: false,
  },
  {
    number: "7",
    title: "Neue\nAnmeldungen",
    description:
      "Demo-Modul für neue Trainers, neue Players und neue Vereinsfunktionäre.",
    href: "/dashboard/neu-anmeldungen",
    icon: UserPlus,
    carrySeason: false,
  },
  {
    number: "8",
    title: "Users & Roles",
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
  const currentSeasonLabel = selectedSeason?.name ?? selectedSeason?.key ?? "2025/2026";
  const nextSeasonLabel =
    seasonOptions.find((season) => !season.isActive && season.key !== selectedSeasonKey)?.name ?? seasonOptions.find((season) => !season.isActive && season.key !== selectedSeasonKey)?.key ??
    seasonOptions.find((season) => season.key !== selectedSeasonKey)?.name ?? seasonOptions.find((season) => season.key !== selectedSeasonKey)?.key ??
    "2026/2027";

  return (
    <div className="space-y-6">
      <AdminSurfaceCard className="overflow-hidden rounded-[34px] p-0">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
        <div className="p-6 lg:p-8">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {DASHBOARD_MODULES.map((module) => {
              const Icon = module.icon;
              const href =
                selectedSeasonKey && module.carrySeason
                  ? `${module.href}?season=${encodeURIComponent(selectedSeasonKey)}`
                  : module.href;

              const seasonBadgeLabel =
                module.seasonBadgeTone === "current"
                  ? currentSeasonLabel
                  : module.seasonBadgeTone === "next"
                    ? nextSeasonLabel
                    : null;

              return (
                <Link
                  key={module.title}
                  href={href}
                  className="group flex min-h-[278px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white px-6 pb-6 pt-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-[3px] hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-600">
                        Modul {module.number}
                      </p>
                    </div>

                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#0b4aa2] shadow-sm transition group-hover:scale-105">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-start gap-2">
                    <h3 className="whitespace-pre-line font-[var(--font-display)] text-[1.95rem] font-bold leading-[0.94] tracking-[-0.045em] text-[#0b4aa2]">
                      {module.title}
                    </h3>

                    {seasonBadgeLabel ? (
                      <span className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {seasonBadgeLabel}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-7 text-[15px] leading-8 text-slate-600">
                    {module.description}
                  </p>

                  <div className="mt-auto pt-7">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#0b4aa2] transition group-hover:border-[#0b4aa2]/20 group-hover:bg-[#0b4aa2]/5">
                      Modul öffnen
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </AdminSurfaceCard>
    </div>
  );
}