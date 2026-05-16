import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Globe,
  Info,
  Lightbulb,
  Newspaper,
  Settings2,
  Settings,
  Shield,
  Tag,
  Target,
  UserCircle2,
  UserRound,
  Users,
} from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { ADMIN_MODULES } from "@/lib/permissions/admin-modules";
import { isSuperAdmin } from "@/lib/permissions/is-super-admin";

// ── Icon map keyed by module key ──────────────────────────────────────────────
const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard: Settings,
  strategy: Target,
  exercises: BookOpen,
  "training-bulk-tag": Tag,
  seasons: CalendarRange,
  planner: ClipboardList,
  events: CalendarDays,
  wochenplan: ClipboardList,
  users: Shield,
  teams: Users,
  persons: UserCircle2,
  players: UserRound,
  trainers: UserRound,
  website: Globe,
  "website-news": Newspaper,
  "website-sponsors": Award,
  "website-review": ClipboardCheck,
  "website-settings": Settings2,
  logs: FileText,
  // Vereinsleitung handled separately
};

// Additional static cards not in ADMIN_MODULES (no permission requirement)
const STATIC_MODULES = [
  {
    key: "vereinsleitung",
    title: "Vereinsleitung",
    description: "Strategische Steuerung des Vereins mit Meetings, Initiativen, KPIs und Entscheidungen.",
    href: "/vereinsleitung",
    icon: Briefcase,
    carrySeason: false,
    requiredPermissions: undefined as undefined,
    showInGrid: true as const,
  },
];

type DashboardPageProps = {
  searchParams?: Promise<{ season?: string; error?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const session = await auth();
  const permissionKeys = session?.user?.permissionKeys ?? [];
  const superAdmin = isSuperAdmin(session);

  const seasonOptions = await getSeasonOptionsData();
  const selectedSeason =
    seasonOptions.find((s) => s.key === params.season) ??
    seasonOptions.find((s) => s.isActive) ??
    seasonOptions[0] ??
    null;
  const selectedSeasonKey = selectedSeason?.key ?? "";

  const untaggedTrainingCount = selectedSeason
    ? await prisma.event.count({
        where: { seasonId: selectedSeason.id, type: "TRAINING", trainingFocus: null },
      })
    : 0;

  // Superadmin sees all modules (including showInGrid:false except dashboard itself)
  const visibleModules = ADMIN_MODULES.filter((m) => {
    if (m.key === "dashboard") return false; // never show self-link
    if (superAdmin) return true;             // superadmin sees everything
    if (m.showInGrid === false) return false;
    if (!m.requiredPermissions || m.requiredPermissions.length === 0) return true;
    return m.requiredPermissions.some((p) => permissionKeys.includes(p));
  });

  // Combine: Vereinsleitung first, then ADMIN_MODULES
  const gridModules = [
    ...STATIC_MODULES,
    ...visibleModules.map((m) => ({
      key: m.key,
      title: m.title,
      description: m.description,
      href: m.href,
      icon: MODULE_ICONS[m.key] ?? Settings,
      carrySeason: m.carrySeason ?? false,
      showInGrid: true as const,
    })),
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:p-7">
        <p className="fca-eyebrow">Dashboard</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2] lg:text-[2.35rem]">
          Saisongeführte Modulübersicht
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Saisons sind die führende Struktur dieser WebApp. Teams, Events und Planner
          werden dynamisch pro Saison verwaltet und darauf aufgebaut.
        </p>
      </section>

      {/* Superadmin badge */}
      {superAdmin && (
        <div className="flex items-center gap-2 rounded-[16px] border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-4 py-2.5">
          <Info className="h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
          <p className="text-[12px] font-semibold text-[#0b4aa2]">
            Superadmin-Zugriff aktiv — globale Plattformverwaltung.
          </p>
        </div>
      )}

      {/* Access-denied feedback (from redirects) */}
      {params.error === "access-denied" && (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
          Du hast keinen Zugriff auf dieses Modul.
        </div>
      )}

      <SeasonContextSelector
        title="Aktive Saison"
        description="Diese Auswahl wird als Kontext für saisongeführte Module wie Saisonplanner, Teams, Events und später weitere Planer verwendet."
        seasons={seasonOptions}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard"
      />

      {untaggedTrainingCount > 0 && (
        <div className="flex items-start justify-between gap-4 rounded-[24px] border border-amber-200 bg-amber-50/80 px-5 py-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">
                {untaggedTrainingCount} Training{untaggedTrainingCount !== 1 ? "s" : ""} ohne Schwerpunkt
              </span>{" "}
              in dieser Saison – KPI-Tracking lückenhaft.
            </p>
          </div>
          <Link
            href="/dashboard/training/bulk-tag"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-800 transition hover:bg-amber-50"
          >
            <Tag className="h-3 w-3" />
            Jetzt taggen
          </Link>
        </div>
      )}

      <AdminSurfaceCard className="p-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {gridModules.map((module) => {
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
                    <p className="mt-3 text-sm text-slate-600">
                      {module.description}
                    </p>
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
    </div>
  );
}
