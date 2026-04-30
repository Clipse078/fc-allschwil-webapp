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
  CheckCircle2,
} from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import { getMyTaskCount } from "@/lib/tasks/get-my-task-count";

const DASHBOARD_MODULES = [
  {
    number: "0",
    title: "Meine\nAufgaben",
    description:
      "Deine offenen Aufgaben aus allen Bereichen – direkt bearbeiten und vorwärts bringen.",
    href: "/dashboard/tasks",
    icon: CheckCircle2,
    highlight: true,
  },

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
      "Aktuelle Saison mit Teams, Jahresplan, Wochenplan, Platzreservation und Infoboard.",
    href: "/dashboard/current-season",
    icon: CalendarRange,
    carrySeason: true,
    seasonBadgeTone: "current",
  },
  {
    number: "5",
    title: "Nächste Saison",
    description:
      "Vorbereitung der kommenden Saison mit Teams, Spielern und Trainern.",
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
  const taskCount = await getMyTaskCount();

  const selectedSeason =
    seasonOptions.find((season) => season.key === params.season) ??
    seasonOptions.find((season) => season.isActive) ??
    seasonOptions[0] ??
    null;

  const selectedSeasonKey = selectedSeason?.key ?? "";

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

              const isTasks = module.number === "0";

              return (
                <Link
                  key={module.title}
                  href={href}
                  className={`group flex min-h-[278px] flex-col overflow-hidden rounded-[28px] border px-6 pb-6 pt-6 transition duration-200 hover:-translate-y-[3px]
                  ${
                    isTasks
                      ? "border-red-300 bg-red-50 shadow-[0_12px_30px_rgba(220,38,38,0.15)]"
                      : "border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-600">
                      Modul {module.number}
                    </p>

                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <h3 className="whitespace-pre-line font-[var(--font-display)] text-[1.9rem] font-bold leading-[0.94] tracking-[-0.045em] text-[#0b4aa2]">
                      {module.title}
                    </h3>

                    {isTasks && taskCount > 0 && (
                      <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                        {taskCount}
                      </span>
                    )}
                  </div>

                  <p className="mt-6 text-[15px] leading-7 text-slate-600">
                    {module.description}
                  </p>

                  <div className="mt-auto pt-6">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#0b4aa2]">
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
