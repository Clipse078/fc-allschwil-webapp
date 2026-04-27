import Link from "next/link";
import {
  BarChart3,
  CalendarSync,
  ChevronRight,
  DatabaseZap,
  Globe2,
  Network,
  Palette,
  Settings,
  ShieldCheck,
  Trophy,
  Workflow,
} from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
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
    label: "Aktive Saison, Übergangsdatum",
    icon: Settings,
    href: "/dashboard/current-season",
    status: "Basis aktiv",
  },
];

export default async function AdminConfigurationPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const clubConfig = await prisma.clubConfig.findFirst({
    include: {
      teamCategoryRules: {
        orderBy: {
          category: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const activeSeason = await prisma.season.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      startDate: "desc",
    },
  });

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Admin"
        title="Club-Konfiguration"
        description="Zentrale Steuerung für Verein, Rollen, Workflows, Regeln, Website-Anzeige und spätere Mandanten-Konfiguration."
      />

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#0b4aa2] via-[#123f7a] to-slate-950 p-6 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Tenant</p>
              <h2 className="mt-3 text-3xl font-black">{clubConfig?.clubName ?? "FC Allschwil"}</h2>
              <p className="mt-2 text-sm font-semibold text-blue-100">
                {clubConfig?.country ?? "CH"} · {activeSeason?.name ?? "Keine aktive Saison"} · {clubConfig?.teamCategoryRules.length ?? 0} Teamregeln
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

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Teamregeln</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">ClubConfig → TeamCategoryRule</h2>
            </div>
            <DatabaseZap className="h-6 w-6 text-[#0b4aa2]" />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {(clubConfig?.teamCategoryRules ?? []).map((rule) => (
              <div key={rule.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-slate-900">{rule.category}</h3>
                  <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-black text-[#0b4aa2]">
                    {rule.minTrainerCount} Trainer
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    {rule.requiredDiploma}
                  </span>
                  {rule.allowedBirthYears.length > 0 ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                      {rule.allowedBirthYears.join(" + ")}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Admin Regel</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Website / Mobile Anzeige</h2>
            </div>
            <ShieldCheck className="h-6 w-6 text-[#0b4aa2]" />
          </div>

          <div className="mt-5 space-y-3">
            {[
              "Teamseiten-Anzeige wird zentral im Admin Modul gesteuert.",
              "Auf Teamseiten für Nicht-Admins nur read-only.",
              "Admin darf zentral und auf Teamdetailseite steuern.",
              "Später tenant-spezifisch pro Club konfigurierbar.",
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}


