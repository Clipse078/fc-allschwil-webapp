import Link from "next/link";
import {
  BarChart3,
  CalendarSync,
  ChevronRight,
  DatabaseZap,
  Goal,
  Globe2,
  Network,
  Palette,
  Settings,
  ShieldCheck,
  Trophy,
  Workflow,
} from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TeamCategoryRulesEditor from "@/components/admin/configuration/TeamCategoryRulesEditor";
import TeamDisplaySettingsEditor from "@/components/admin/configuration/TeamDisplaySettingsEditor";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";

const adminCards = [
  {
    title: "Club Info",
    label: "Standort, Logo, Stammdaten",
    icon: Globe2,
    href: "/dashboard/admin",
    status: "Grundlage",
  },
  {
    title: "Branding / Farben",
    label: "Website, WebApp, Infoboard, Mobile",
    icon: Palette,
    href: "/dashboard/admin",
    status: "Geplant",
  },
  {
    title: "Team-Anzeige",
    label: "Website / Mobile Detailseiten",
    icon: Trophy,
    href: "/dashboard/admin",
    status: "Admin-only",
  },
  {
    title: "Organigramm Builder",
    label: "Divisions, Departments, Rollen",
    icon: Network,
    href: "/vereinsleitung/organigramm",
    status: "Move to Admin",
  },
  {
    title: "Roles & Workflow",
    label: "Prepare, Review, Approve, Publish",
    icon: Workflow,
    href: "/dashboard/users",
    status: "Config-driven",
  },
  {
    title: "KPI Builder",
    label: "Dynamische KPI-Regeln",
    icon: BarChart3,
    href: "/vereinsleitung/kpis",
    status: "Gestartet",
  },
  {
    title: "Jahresplaner / API Sync",
    label: "Clubcorner / FVNWS on/off",
    icon: CalendarSync,
    href: "/dashboard/next-season/jahresplan",
    status: "Geplant",
  },
  {
    title: "Season Switcher",
    label: "Aktive Saison, Ãœbergangsdatum",
    icon: Settings,
    href: "/dashboard/current-season",
    status: "Basis aktiv",
  },
];

export default async function AdminConfigurationPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const clubConfig = await prisma.clubConfig.findFirst({
    include: {
      teamCategoryRules: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const teamRuleOrder = [
    "AKTIVE",
    "FRAUEN",
    "A",
    "B",
    "C",
    "D9",
    "D7",
    "E",
    "F",
    "G",
    "TRAININGSGRUPPE",
  ];

  const orderedTeamCategoryRules = [...(clubConfig?.teamCategoryRules ?? [])].sort(
    (a, b) =>
      (a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : (teamRuleOrder.indexOf(a.category) === -1 ? 999 : teamRuleOrder.indexOf(a.category)) -
          (teamRuleOrder.indexOf(b.category) === -1 ? 999 : teamRuleOrder.indexOf(b.category)))
  );
  const activeSeason = await prisma.season.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      startDate: "desc",
    },
  });
  const activeSeasonTeamSettings = activeSeason
    ? await prisma.teamSeason.findMany({
        where: {
          seasonId: activeSeason.id,
        },
        orderBy: {
          team: {
            sortOrder: "asc",
          },
        },
        select: {
          id: true,
          squadWebsiteVisible: true,
          trainerTeamWebsiteVisible: true,
          trainingsWebsiteVisible: true,
          upcomingMatchesWebsiteVisible: true,
          resultsWebsiteVisible: true,
          standingsWebsiteVisible: true,
          season: {
            select: {
              name: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              websiteVisible: true,
            },
          },
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Admin"
        title="Club-Konfiguration"
        description="Zentrale Steuerung fÃ¼r Verein, Rollen, Workflows, Regeln, Website-Anzeige und spÃ¤tere Mandanten-Konfiguration."
      />

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#0b4aa2] via-[#123f7a] to-slate-950 p-6 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Tenant</p>
              <h2 className="mt-3 text-3xl font-black">{clubConfig?.clubName ?? "FC Allschwil"}</h2>
              <p className="mt-2 text-sm font-semibold text-blue-100">
                {clubConfig?.country ?? "CH"} Â· {activeSeason?.name ?? "Keine aktive Saison"} Â· {clubConfig?.teamCategoryRules.length ?? 0} Teamregeln
              </p>
            </div>
            <span className="w-fit rounded-full border border-emerald-200/60 bg-emerald-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-emerald-100">
              Konfiguration aktiv
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Country</p>
            <p className="mt-2 text-xl font-black text-slate-900">{clubConfig?.country ?? "CH"}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Teamregeln</p>
            <p className="mt-2 text-xl font-black text-slate-900">{clubConfig?.teamCategoryRules.length ?? 0}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Aktive Saison</p>
            <p className="mt-2 text-xl font-black text-slate-900">{activeSeason?.name ?? "Offen"}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Architektur</p>
            <p className="mt-2 text-xl font-black text-slate-900">DB-driven</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-4">
        {adminCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-blue-50 p-3 text-[#0b4aa2]">
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#0b4aa2]" />
              </div>
              <h3 className="mt-5 font-black text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">{card.label}</p>
              <span className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">
                {card.status}
              </span>
            </Link>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="bg-gradient-to-br from-slate-950 via-[#0b4aa2] to-[#123f7a] p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Admin Modul</p>
              <h2 className="mt-2 text-2xl font-black">Team Management</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-blue-100">Zentrale Steuerung für Teamkategorien, Trainer-/Diplom-Regeln, Health-KPIs und Website/Mobile Anzeige pro Team.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white">
              <Goal className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 lg:p-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Teamregeln</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">ClubConfig â†’ TeamCategoryRule</h2>
            </div>
            <DatabaseZap className="h-6 w-6 text-[#0b4aa2]" />
          </div>

          <TeamCategoryRulesEditor
            clubConfigId={clubConfig?.id ?? null}
            rules={orderedTeamCategoryRules.map((rule) => ({
              id: rule.id,
              category: rule.category,
              minTrainerCount: rule.minTrainerCount,
              requiredDiploma: rule.requiredDiploma,
              requiredDiplomaTrainerCount: rule.requiredDiplomaTrainerCount,
              maxPlayersPerTrainer: rule.maxPlayersPerTrainer,
              allowedBirthYears: rule.allowedBirthYears,
              sortOrder: rule.sortOrder,
            }))}
          />
        </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Team Anzeige</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Website / Mobile Anzeige</h2>
            </div>
            <ShieldCheck className="h-6 w-6 text-[#0b4aa2]" />
          </div>

          <TeamDisplaySettingsEditor
            teams={activeSeasonTeamSettings.map((entry) => ({
              teamId: entry.team.id,
              teamName: entry.team.name,
              teamSeasonId: entry.id,
              seasonName: entry.season.name,
              teamPageWebsiteVisible: entry.team.websiteVisible,
              squadWebsiteVisible: entry.squadWebsiteVisible,
              trainerTeamWebsiteVisible: entry.trainerTeamWebsiteVisible,
              trainingsWebsiteVisible: entry.trainingsWebsiteVisible,
              upcomingMatchesWebsiteVisible: entry.upcomingMatchesWebsiteVisible,
              resultsWebsiteVisible: entry.resultsWebsiteVisible,
              standingsWebsiteVisible: entry.standingsWebsiteVisible,
            }))}
          />
          </div>
        </div>
      </section>
    </div>
  );
}

