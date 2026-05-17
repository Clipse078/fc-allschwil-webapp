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

// ─── Data ────────────────────────────────────────────────────────────────────

type ClubModule = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  carrySeason: boolean;
  eyebrow: string;
};

const CLUB_MODULES: ClubModule[] = [
  {
    eyebrow: "Club",
    title: "Teams",
    description: "Season-led team management. Categories, squads, and trainers by season.",
    href: "/dashboard/teams",
    icon: Users,
    carrySeason: true,
  },
  {
    eyebrow: "Club",
    title: "Seasons",
    description: "The primary structure. Build teams, events, and planners within a season.",
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
    description: "Full season agenda with week and day views. Multi-team scheduling.",
    href: "/dashboard/planner",
    icon: ClipboardList,
    carrySeason: true,
  },
  {
    eyebrow: "Club",
    title: "People",
    description: "Person master data as the foundation for players, trainers, and roles.",
    href: "/dashboard/persons",
    icon: UserCircle2,
    carrySeason: false,
  },
  {
    eyebrow: "Club",
    title: "Club Leadership",
    description: "Strategic governance with meetings, initiatives, KPIs, and decisions.",
    href: "/vereinsleitung",
    icon: Briefcase,
    carrySeason: false,
  },
];

type PlatformCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  external?: boolean;
};

const PLATFORM_CARDS: PlatformCard[] = [
  {
    title: "Tenants / Clubs",
    description: "Manage registered clubs, their branding, sport type, and configuration.",
    href: "/dashboard/tenants",
    icon: Building2,
  },
  {
    title: "Users & Roles",
    description: "Users, roles, and permissions across the entire platform.",
    href: "/dashboard/users",
    icon: Shield,
  },
  {
    title: "System Health",
    description: "Runtime diagnostics, deployment status, and live environment info.",
    href: "/dashboard/runtime",
    icon: Activity,
  },
  {
    title: "Platform Settings",
    description: "Global configuration, feature flags, and platform-level defaults.",
    href: "/dashboard/logs",
    icon: Settings,
  },
  {
    title: "Billing & Plans",
    description: "Subscription management and per-tenant plan allocation.",
    href: "#",
    icon: CreditCard,
    badge: "Soon",
  },
  {
    title: "Website Builder",
    description: "Public-facing club websites, infoboards, and embeddable widgets.",
    href: "#",
    icon: Globe,
    badge: "Soon",
  },
];

// ─── Small components ─────────────────────────────────────────────────────────

function SceWordmark() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
      <span className="font-[var(--font-display)] text-[0.85rem] font-black tracking-tight text-white">
        SCE
      </span>
    </div>
  );
}

function StatusChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "platform";
}) {
  const base = "flex flex-col gap-1 rounded-[20px] border p-4";
  const styles =
    tone === "success"
      ? `${base} border-emerald-200/70 bg-white/60`
      : tone === "platform"
        ? `${base} border-indigo-200/60 bg-indigo-50/50`
        : `${base} border-slate-200/80 bg-white/70`;

  const valueStyles =
    tone === "success"
      ? "text-sm font-semibold text-emerald-700"
      : tone === "platform"
        ? "text-sm font-semibold text-indigo-700"
        : "text-sm font-semibold text-slate-800";

  return (
    <div className={styles}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className={valueStyles}>{value}</p>
    </div>
  );
}

function ClubModuleCard({
  module,
  href,
}: {
  module: ClubModule;
  href: string;
}) {
  const Icon = module.icon;

  return (
    <Link
      href={href}
      className="group relative rounded-[26px] border border-slate-200/90 bg-white/80 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] backdrop-blur-sm transition duration-200 hover:-translate-y-[2px] hover:border-[#0b4aa2]/20 hover:shadow-[0_16px_40px_rgba(11,74,162,0.10)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {module.eyebrow}
          </p>
          <h3 className="mt-1.5 font-[var(--font-display)] text-[1.35rem] font-bold uppercase leading-tight tracking-[-0.02em] text-[#0b4aa2]">
            {module.title}
          </h3>
          <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-500">
            {module.description}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0b4aa2] shadow-sm transition duration-200 group-hover:scale-105 group-hover:border-[#0b4aa2]/20">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

function PlatformModuleCard({ card }: { card: PlatformCard }) {
  const Icon = card.icon;
  const isPlaceholder = card.href === "#";

  const inner = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">
            Platform
          </p>
          {card.badge ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
              {card.badge}
            </span>
          ) : null}
        </div>
        <h3 className="mt-1.5 font-[var(--font-display)] text-[1.2rem] font-bold uppercase leading-tight tracking-[-0.02em] text-slate-800">
          {card.title}
        </h3>
        <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-500">
          {card.description}
        </p>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm transition duration-200 group-hover:scale-105">
        <Icon className="h-4.5 w-4.5 h-5 w-5" />
      </div>
    </div>
  );

  if (isPlaceholder) {
    return (
      <div className="relative cursor-default rounded-[26px] border border-dashed border-slate-200 bg-slate-50/60 p-5 opacity-70">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={card.href}
      className="group relative rounded-[26px] border border-indigo-100/80 bg-white/80 p-5 shadow-[0_4px_20px_rgba(99,102,241,0.06)] backdrop-blur-sm transition duration-200 hover:-translate-y-[2px] hover:border-indigo-300/50 hover:shadow-[0_16px_40px_rgba(99,102,241,0.12)]"
    >
      {inner}
    </Link>
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
    ? "Superadmin"
    : roleKeys.length > 0
      ? roleKeys[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "User";

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
    <div className="space-y-7">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-[32px] p-7 lg:p-9"
        style={{
          background: "linear-gradient(135deg, #0b4aa2 0%, #0f3a8a 55%, #1a2f6e 100%)",
        }}
      >
        {/* Background glow accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-12 left-12 h-48 w-48 rounded-full bg-indigo-400/10 blur-2xl" />
        </div>

        <div className="relative">
          {/* Wordmark row */}
          <div className="flex items-center gap-3">
            <SceWordmark />
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/50">
                Platform
              </p>
              <p className="font-[var(--font-display)] text-[1.1rem] font-black uppercase tracking-[-0.02em] text-white">
                SportClubEvo
              </p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="mt-5 font-[var(--font-display)] text-[2.1rem] font-bold uppercase leading-[0.93] tracking-[-0.04em] text-white lg:text-[2.8rem]">
            Operating system
            <br />
            <span className="text-white/70">for modern sports clubs</span>
          </h1>

          {/* Chips row */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {activeTenantId ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-2 ring-1 ring-white/20 backdrop-blur-sm">
                <Building2 className="h-3.5 w-3.5 text-white/70" />
                <span className="text-[0.78rem] font-semibold text-white">
                  {activeTenantName ?? activeTenantId}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3.5 py-2 ring-1 ring-white/15">
                <Building2 className="h-3.5 w-3.5 text-white/40" />
                <span className="text-[0.78rem] font-medium text-white/50">No club selected</span>
              </div>
            )}

            {isSuperAdmin ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3.5 py-2 ring-1 ring-amber-300/25">
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-[0.78rem] font-semibold text-amber-200">Superadmin</span>
              </div>
            ) : null}

            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/12 px-3.5 py-2 ring-1 ring-emerald-300/20">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-[0.78rem] font-medium text-emerald-200">Platform live</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusChip
          label="Active Club"
          value={activeTenantName ?? "None selected"}
          tone={activeTenantId ? "default" : "default"}
        />
        {isSuperAdmin && tenantsCount !== null ? (
          <StatusChip
            label="Registered Clubs"
            value={`${tenantsCount} ${tenantsCount === 1 ? "club" : "clubs"}`}
            tone="platform"
          />
        ) : (
          <StatusChip label="Role" value={displayRole} tone="default" />
        )}
        <StatusChip
          label="Current Role"
          value={displayRole}
          tone={isSuperAdmin ? "platform" : "default"}
        />
        <StatusChip
          label="Tenant Filtering"
          value={activeTenantId ? "Active" : "Global view"}
          tone={activeTenantId ? "success" : "default"}
        />
      </div>

      {/* ── Platform Console (superadmin only) ──────────────────────────── */}
      {isSuperAdmin ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
              <LayoutDashboard className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Superadmin only
              </p>
              <h2 className="text-base font-bold text-slate-800">Platform Console</h2>
            </div>
          </div>

          <div className="rounded-[28px] border border-indigo-100/70 bg-indigo-50/30 p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {PLATFORM_CARDS.map((card) => (
                <PlatformModuleCard key={card.title} card={card} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Club Modules ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-[#0b4aa2]">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {activeTenantName ? activeTenantName : "Club"}
            </p>
            <h2 className="text-base font-bold text-slate-800">Club Modules</h2>
          </div>
        </div>

        <SeasonContextSelector
          title="Active Season"
          description="Season context for teams, events, planner and other season-scoped modules."
          seasons={seasonOptions}
          selectedSeasonKey={selectedSeasonKey}
          basePath="/dashboard"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CLUB_MODULES.map((module) => {
            const href =
              selectedSeasonKey && module.carrySeason
                ? `${module.href}?season=${encodeURIComponent(selectedSeasonKey)}`
                : module.href;

            return <ClubModuleCard key={module.href} module={module} href={href} />;
          })}
        </div>

        {/* Secondary club tools row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/players"
            className="group flex items-center gap-4 rounded-[22px] border border-slate-200/90 bg-white/70 px-5 py-4 transition duration-200 hover:-translate-y-[1px] hover:border-[#0b4aa2]/20 hover:shadow-[0_8px_24px_rgba(11,74,162,0.08)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0b4aa2] shadow-sm transition group-hover:scale-105">
              <UserRound className="h-4.5 w-4.5 h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Club
              </p>
              <p className="font-[var(--font-display)] text-sm font-bold uppercase tracking-[-0.01em] text-[#0b4aa2]">
                Players & Trainers
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Season-scoped squads and coaching staff
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/users"
            className="group flex items-center gap-4 rounded-[22px] border border-slate-200/90 bg-white/70 px-5 py-4 transition duration-200 hover:-translate-y-[1px] hover:border-[#0b4aa2]/20 hover:shadow-[0_8px_24px_rgba(11,74,162,0.08)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0b4aa2] shadow-sm transition group-hover:scale-105">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Club
              </p>
              <p className="font-[var(--font-display)] text-sm font-bold uppercase tracking-[-0.01em] text-[#0b4aa2]">
                Users & Access
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Manage app users, roles, and permissions
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
