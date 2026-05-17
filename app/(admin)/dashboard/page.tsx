import Link from "next/link";
import {
  Activity,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Globe,
  LayoutDashboard,
  Lock,
  Settings,
  Shield,
  UserCircle2,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { auth } from "@/auth";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import { getTenantsCount } from "@/lib/tenants/queries";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModuleCard = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  carrySeason: boolean;
};

type PlatformCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  comingSoon?: boolean;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const CLUB_MODULES: ModuleCard[] = [
  {
    eyebrow: "Club",
    title: "Teams",
    description: "Season-led squads, categories, coaches — built around the active season.",
    href: "/dashboard/teams",
    icon: Users,
    carrySeason: true,
  },
  {
    eyebrow: "Club",
    title: "Seasons",
    description: "The primary structure. All teams, events, and planning are season-scoped.",
    href: "/dashboard/seasons",
    icon: CalendarRange,
    carrySeason: true,
  },
  {
    eyebrow: "Club",
    title: "Events",
    description: "Matches, tournaments, trainings, and club events — all season-scoped.",
    href: "/dashboard/events",
    icon: CalendarDays,
    carrySeason: true,
  },
  {
    eyebrow: "Club",
    title: "Planner",
    description: "Full season agenda. Week and day views, multi-team scheduling.",
    href: "/dashboard/planner",
    icon: ClipboardList,
    carrySeason: true,
  },
  {
    eyebrow: "Club",
    title: "People",
    description: "Person master data — the foundation for players, trainers, and roles.",
    href: "/dashboard/persons",
    icon: UserCircle2,
    carrySeason: false,
  },
  {
    eyebrow: "Club",
    title: "Club Leadership",
    description: "Strategic governance: meetings, initiatives, KPIs, decisions.",
    href: "/vereinsleitung",
    icon: Briefcase,
    carrySeason: false,
  },
];

const PLATFORM_CARDS: PlatformCard[] = [
  {
    title: "Tenants / Clubs",
    description: "Register and manage clubs, branding, sport type, and configuration.",
    href: "/dashboard/tenants",
    icon: Building2,
  },
  {
    title: "Users & Roles",
    description: "Accounts, roles, and permission sets across the entire platform.",
    href: "/dashboard/users",
    icon: Shield,
  },
  {
    title: "System Health",
    description: "Runtime diagnostics, deployment info, and live environment status.",
    href: "/dashboard/runtime",
    icon: Activity,
  },
  {
    title: "Audit Logs",
    description: "Full activity trail — every platform action logged and searchable.",
    href: "/dashboard/logs",
    icon: LayoutDashboard,
  },
  {
    title: "Billing & Plans",
    description: "Per-tenant subscription management and plan allocation.",
    href: "#",
    icon: CreditCard,
    comingSoon: true,
  },
  {
    title: "Website Builder",
    description: "Public club websites, infoboards, and embeddable event widgets.",
    href: "#",
    icon: Globe,
    comingSoon: true,
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function SceHero({
  activeTenantName,
  activeTenantId,
  isSuperAdmin,
  tenantsCount,
}: {
  activeTenantName: string | null;
  activeTenantId: string | null;
  isSuperAdmin: boolean;
  tenantsCount: number | null;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[28px] p-6 lg:p-8"
      style={{
        background: "linear-gradient(135deg, #071f4d 0%, #0b4aa2 45%, #1a3d82 100%)",
      }}
    >
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[0.03] blur-3xl" />
        <div className="absolute -bottom-16 left-8 h-56 w-56 rounded-full bg-[#22c55e]/[0.06] blur-2xl" />
        <div className="absolute right-1/3 top-0 h-px w-2/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        {/* Soft grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative">
        {/* Platform identity row */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/15 ring-1 ring-white/20">
            <span className="font-[var(--font-display)] text-[0.78rem] font-black tracking-tight text-white">
              SCE
            </span>
          </div>
          <div>
            <p className="text-[0.63rem] font-semibold uppercase tracking-[0.24em] text-white/45">
              Operating System
            </p>
            <p className="font-[var(--font-display)] text-[0.95rem] font-black uppercase tracking-[-0.01em] text-white/90">
              SportClubEvo
            </p>
          </div>
        </div>

        {/* Main headline */}
        <h1 className="mt-5 font-[var(--font-display)] text-[1.9rem] font-bold uppercase leading-[0.92] tracking-[-0.04em] text-white lg:text-[2.4rem]">
          Platform
          <br />
          <span className="text-white/55">Dashboard</span>
        </h1>

        {/* Tagline */}
        <p className="mt-3 max-w-[480px] text-[0.82rem] font-medium leading-relaxed text-white/50">
          One operating system. Less chaos. More focus on sport and community.
        </p>

        {/* Ecosystem modules row */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-[#22c55e]/30 bg-[#22c55e]/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#86efac]">
            WebApp
          </span>
          <span className="text-[0.6rem] text-white/20">·</span>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white/40">
            Website
          </span>
          <span className="text-[0.6rem] text-white/20">·</span>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white/40">
            InfoBoard
          </span>
          <span className="text-[0.6rem] text-white/20">·</span>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white/40">
            Mobile App
          </span>
        </div>

        {/* Status chips */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {activeTenantId ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 ring-1 ring-white/18">
              <Building2 className="h-3 w-3 text-white/65" />
              <span className="text-[0.75rem] font-semibold text-white">
                {activeTenantName ?? activeTenantId}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/7 px-3 py-1.5 ring-1 ring-white/12">
              <Building2 className="h-3 w-3 text-white/35" />
              <span className="text-[0.75rem] font-medium text-white/40">No club active</span>
            </div>
          )}

          {isSuperAdmin ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/18 px-3 py-1.5 ring-1 ring-amber-300/22">
              <Zap className="h-3 w-3 text-amber-300" />
              <span className="text-[0.75rem] font-semibold text-amber-200">Platform Admin</span>
            </div>
          ) : null}

          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/14 px-3 py-1.5 ring-1 ring-emerald-300/18">
            <CheckCircle2 className="h-3 w-3 text-emerald-300" />
            <span className="text-[0.75rem] font-medium text-emerald-200">Platform online</span>
          </div>

          {tenantsCount !== null ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/14">
              <span className="text-[0.75rem] font-medium text-white/60">
                {tenantsCount} {tenantsCount === 1 ? "club" : "clubs"} registered
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatusRow({
  activeTenantName,
  activeTenantId,
  isSuperAdmin,
  tenantsCount,
  displayRole,
}: {
  activeTenantName: string | null;
  activeTenantId: string | null;
  isSuperAdmin: boolean;
  tenantsCount: number | null;
  displayRole: string;
}) {
  const chips = [
    {
      label: "Active Club",
      value: activeTenantName ?? (activeTenantId ? activeTenantId.slice(0, 8) : "None"),
      accent: activeTenantId ? "blue" : "muted",
    },
    {
      label: "Current Role",
      value: displayRole,
      accent: isSuperAdmin ? "indigo" : "muted",
    },
    {
      label: tenantsCount !== null ? "Registered Clubs" : "Platform",
      value: tenantsCount !== null ? String(tenantsCount) : "Tenant-aware",
      accent: "muted",
    },
    {
      label: "Tenant Filtering",
      value: activeTenantId ? "Active" : "Global view",
      accent: activeTenantId ? "green" : "muted",
    },
  ] as const;

  const accentClass = (a: string) => {
    if (a === "blue")   return "border-blue-200/70   bg-blue-50/60   text-blue-800";
    if (a === "indigo") return "border-indigo-200/70 bg-indigo-50/60 text-indigo-800";
    if (a === "green")  return "border-emerald-200/70 bg-emerald-50/60 text-emerald-800";
    return "border-slate-200/80 bg-white/60 text-slate-700";
  };

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className={`flex flex-col gap-1 rounded-[18px] border px-4 py-3 ${accentClass(chip.accent)}`}
        >
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] opacity-60">
            {chip.label}
          </p>
          <p className="text-sm font-bold">{chip.value}</p>
        </div>
      ))}
    </div>
  );
}

function PlatformModuleCard({ card }: { card: PlatformCard }) {
  const Icon = card.icon;

  if (card.comingSoon) {
    return (
      <div className="group relative flex flex-col rounded-[22px] border border-dashed border-slate-200/90 bg-slate-50/50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Platform
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">
                <Lock className="h-2.5 w-2.5" />
                Planned
              </span>
            </div>
            <h3 className="mt-1 text-[0.9rem] font-bold text-slate-500">{card.title}</h3>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-slate-400">
              {card.description}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-slate-100 text-slate-300">
            <Icon className="h-4.5 w-4.5 h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-[0.72rem] font-medium text-slate-400">
          Planned platform module · coming in a future release
        </p>
      </div>
    );
  }

  return (
    <Link
      href={card.href}
      className="group flex flex-col rounded-[22px] border border-indigo-100/60 bg-white/85 p-5 shadow-[0_2px_12px_rgba(99,102,241,0.06)] transition duration-200 hover:-translate-y-[2px] hover:border-indigo-200/80 hover:shadow-[0_12px_32px_rgba(99,102,241,0.11)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-indigo-400">
            Platform
          </p>
          <h3 className="mt-1 text-[0.9rem] font-bold text-slate-800">{card.title}</h3>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-slate-500">
            {card.description}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-500 shadow-sm transition duration-200 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

function ClubModuleCard({ module, href }: { module: ModuleCard; href: string }) {
  const Icon = module.icon;
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[22px] border border-slate-200/90 bg-white/85 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-[2px] hover:border-[#0b4aa2]/20 hover:shadow-[0_12px_32px_rgba(11,74,162,0.09)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {module.eyebrow}
          </p>
          <h3 className="mt-1 font-[var(--font-display)] text-[1.15rem] font-bold uppercase leading-tight tracking-[-0.02em] text-[#0b4aa2]">
            {module.title}
          </h3>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-slate-500">
            {module.description}
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0b4aa2] shadow-sm transition duration-200 group-hover:scale-105 group-hover:border-[#0b4aa2]/20">
          <Icon className="h-4.5 w-4.5 h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  accent = "blue",
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  accent?: "blue" | "indigo";
}) {
  const iconBg = accent === "indigo" ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-[#0b4aa2]";
  return (
    <div className="flex items-center gap-2.5 px-0.5">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {eyebrow}
        </p>
        <h2 className="text-[0.9rem] font-bold text-slate-800">{title}</h2>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type DashboardPageProps = {
  searchParams?: Promise<{ season?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  const params = (await searchParams) ?? {};

  const isSuperAdmin = (session?.user?.roleKeys ?? []).includes("super_admin");
  const activeTenantName = session?.user?.activeTenantName ?? null;
  const activeTenantId = session?.user?.activeTenantId ?? null;
  const roleKeys = session?.user?.roleKeys ?? [];

  const displayRole = isSuperAdmin
    ? "Platform Admin"
    : roleKeys.includes("club_admin")
      ? `${activeTenantName ?? "Club"} Admin`
      : roleKeys.length > 0
        ? roleKeys[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Member";

  const [seasonOptions, tenantsCount] = await Promise.all([
    getSeasonOptionsData(),
    isSuperAdmin ? getTenantsCount().catch(() => null) : Promise.resolve(null),
  ]);

  const selectedSeason =
    seasonOptions.find((s) => s.key === params.season) ??
    seasonOptions.find((s) => s.isActive) ??
    seasonOptions[0] ??
    null;

  const selectedSeasonKey = selectedSeason?.key ?? "";

  return (
    <div className="space-y-6">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <SceHero
        activeTenantName={activeTenantName}
        activeTenantId={activeTenantId}
        isSuperAdmin={isSuperAdmin}
        tenantsCount={tenantsCount}
      />

      {/* ── Status row ──────────────────────────────────────────────────── */}
      <StatusRow
        activeTenantName={activeTenantName}
        activeTenantId={activeTenantId}
        isSuperAdmin={isSuperAdmin}
        tenantsCount={tenantsCount}
        displayRole={displayRole}
      />

      {/* ── Platform Console (superadmin only) ──────────────────────────── */}
      {isSuperAdmin ? (
        <section className="space-y-3">
          <SectionHeader
            icon={LayoutDashboard}
            eyebrow="Superadmin · Platform"
            title="Platform Console"
            accent="indigo"
          />
          <div className="rounded-[26px] border border-indigo-100/60 bg-indigo-50/25 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PLATFORM_CARDS.map((card) => (
                <PlatformModuleCard key={card.title} card={card} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Club Modules ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          icon={Building2}
          eyebrow={activeTenantName ? `Club · ${activeTenantName}` : "Club"}
          title="Club Modules"
          accent="blue"
        />

        <SeasonContextSelector
          title="Active Season"
          description="Season context applied to Teams, Events, and Planner."
          seasons={seasonOptions}
          selectedSeasonKey={selectedSeasonKey}
          basePath="/dashboard"
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CLUB_MODULES.map((module) => {
            const href =
              selectedSeasonKey && module.carrySeason
                ? `${module.href}?season=${encodeURIComponent(selectedSeasonKey)}`
                : module.href;
            return <ClubModuleCard key={module.href} module={module} href={href} />;
          })}
        </div>

        {/* Secondary tools */}
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: "/dashboard/players",
              icon: UserRound,
              title: "Players & Trainers",
              desc: "Season-scoped squads and coaching staff",
            },
            {
              href: "/dashboard/users",
              icon: Shield,
              title: "Users & Access",
              desc: "App users, roles, and permission sets",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3.5 rounded-[20px] border border-slate-200/90 bg-white/75 px-4 py-3.5 transition duration-200 hover:-translate-y-[1px] hover:border-[#0b4aa2]/20 hover:shadow-[0_8px_20px_rgba(11,74,162,0.07)]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0b4aa2] shadow-sm transition group-hover:scale-105">
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-[var(--font-display)] text-[0.82rem] font-bold uppercase tracking-[-0.01em] text-[#0b4aa2]">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[0.72rem] text-slate-500">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Platform footer ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-[18px] border border-slate-200/60 bg-white/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0b4aa2]">
            <span className="font-[var(--font-display)] text-[0.6rem] font-black text-white">SCE</span>
          </div>
          <span className="text-[0.75rem] font-semibold text-slate-500">
            SportClubEvo · WebApp · Website · InfoBoard · Mobile App
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[0.72rem] font-medium text-slate-400">
            {activeTenantId ? "1 active club" : "No club selected"}
          </span>
        </div>
      </div>

    </div>
  );
}
