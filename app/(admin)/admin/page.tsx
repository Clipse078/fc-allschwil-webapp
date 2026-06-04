import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarRange,
  ExternalLink,
  KeyRound,
  Plus,
  Shield,
  UserCircle2,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import { auth } from "@/auth";
import { KpiCard } from "@/components/admin/dashboard/KpiCard";
import AdminOnboardingProgress from "@/components/admin/admin/AdminOnboardingProgress";

type SeasonOption = Awaited<ReturnType<typeof getSeasonOptionsData>>[number];

async function getAdminOverviewData(tenantId?: string | null) {
  const [tenant, seasonOptions, counts] = await Promise.all([
    getTenantFromSession(tenantId),
    getSeasonOptionsData(),
    Promise.all([
      prisma.orgUnit.count({ where: { status: { not: "ARCHIVED" } } }),
      prisma.person.count(),
      prisma.team.count(),
      prisma.user.count(),
      prisma.season.count(),
      prisma.role.count(),
      prisma.permission.count(),
    ]),
  ]);

  const [orgUnitCount, personCount, teamCount, userCount, seasonCount, roleCount, permissionCount] = counts;

  const activeSeason =
    seasonOptions.find((s: SeasonOption) => s.shouldBeActive) ??
    seasonOptions.find((s: SeasonOption) => s.isActive) ??
    seasonOptions[0] ??
    null;

  return {
    tenant,
    activeSeason,
    allSeasons: seasonOptions,
    orgUnitCount,
    personCount,
    teamCount,
    userCount,
    seasonCount,
    roleCount,
    permissionCount,
  };
}

function TenantStatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold"
      style={{
        background: isActive ? "rgba(16,185,129,0.15)" : "rgba(156,163,175,0.15)",
        color: isActive ? "#10b981" : "var(--muted)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: isActive ? "#10b981" : "var(--muted)" }}
      />
      {isActive ? "Aktiv" : status}
    </span>
  );
}

function QuickActionButton({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-xs)] transition-all duration-150 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px]"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--blue)] transition-transform duration-150 group-hover:scale-105"
        style={{ background: "var(--blue-light)" }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm font-medium text-[var(--foreground)]">
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
    </Link>
  );
}

function QuickLinkItem({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors duration-120 hover:bg-[var(--surface-2)]"
    >
      <span className="text-sm text-[var(--text-2)] group-hover:text-[var(--foreground)]">
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {count !== undefined && (
          <span
            className="rounded-full px-2 py-0.5 text-[0.68rem] font-semibold tabular-nums"
            style={{ background: "var(--surface-3)", color: "var(--muted)" }}
          >
            {count}
          </span>
        )}
        <ExternalLink className="h-3 w-3 text-[var(--muted)] opacity-0 transition-opacity duration-120 group-hover:opacity-60" />
      </div>
    </Link>
  );
}

export default async function AdminPage() {
  const session = await auth();
  const data = await getAdminOverviewData(session?.user?.tenantId);

  const onboardingSteps = [
    {
      id: "club-info",
      label: "Club-Informationen",
      description: "Vereinsname, Kontaktdaten und grundlegende Stammdaten.",
      status: (data.tenant ? "complete" : "pending") as
        | "complete"
        | "in_progress"
        | "pending",
    },
    {
      id: "branding",
      label: "Branding",
      description: "Logo, Vereinsfarben und Corporate Identity.",
      status: "pending" as const,
    },
    {
      id: "org-setup",
      label: "Organisationsstruktur",
      description:
        "Abteilungen, Ressorts und Ausschüsse im Org Builder erfassen.",
      status: (
        data.orgUnitCount > 0 ? "complete" : "pending"
      ) as "complete" | "in_progress" | "pending",
    },
    {
      id: "teams",
      label: "Teams",
      description: "Mannschaften anlegen und Saisons zuordnen.",
      status: (
        data.teamCount > 0 ? "complete" : "pending"
      ) as "complete" | "in_progress" | "pending",
    },
    {
      id: "seasons",
      label: "Saisons",
      description: "Saisonstruktur für Planner, Teams und Events einrichten.",
      status: (
        data.seasonCount > 0 ? "complete" : "pending"
      ) as "complete" | "in_progress" | "pending",
    },
    {
      id: "users",
      label: "Benutzer",
      description: "Benutzerkonten anlegen und Rollen zuweisen.",
      status: (
        data.userCount > 1 ? "complete" : data.userCount === 1 ? "in_progress" : "pending"
      ) as "complete" | "in_progress" | "pending",
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* ── Entity Hero ──────────────────────────────────────────────── */}
      <div className="sce-entity-hero">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/60">
                Platform
              </p>
              {data.tenant && (
                <TenantStatusBadge status={data.tenant.status} />
              )}
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
              {data.tenant?.name ?? "SportClubEvo"}
            </h1>
            <p className="text-sm text-white/70 max-w-lg">
              Admin-Übersicht — Tenant-Setup, Organisation, Benutzer und
              Plattform-Governance auf einen Blick.
            </p>
          </div>

          {data.activeSeason && (
            <div
              className="shrink-0 rounded-[var(--radius-xl)] px-4 py-3"
              style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(8px)" }}
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/60">
                Aktive Saison
              </p>
              <p className="mt-1 text-base font-bold text-white">
                {data.activeSeason.name}
              </p>
              <p className="mt-0.5 text-[0.72rem] text-white/60">
                {data.activeSeason.lifecycleStatusLabel}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Org-Einheiten"
          value={String(data.orgUnitCount)}
          subtext="Aktive Organisationseinheiten"
          trend="neutral"
          icon={<Building2 style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Personen"
          value={String(data.personCount)}
          subtext="Registrierte Stammdaten"
          trend="neutral"
          icon={<UserCircle2 style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Teams"
          value={String(data.teamCount)}
          subtext="Alle Saisons gesamt"
          trend="neutral"
          icon={<Users style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Benutzer"
          value={String(data.userCount)}
          subtext="Aktive Benutzerkonten"
          trend="neutral"
          icon={<Shield style={{ width: 18, height: 18 }} />}
        />
      </div>

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* Left column */}
        <div className="space-y-6">

          {/* Active season overview */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="min-w-0 flex-1">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  Saisons
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Saisonübersicht
                </p>
              </div>
              <Link
                href="/dashboard/seasons"
                className="flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-[var(--blue)] transition-opacity hover:opacity-70"
              >
                Alle anzeigen
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="sce-detail-section-body">
              {data.allSeasons.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CalendarRange
                    className="text-[var(--muted)]"
                    style={{ width: 28, height: 28 }}
                  />
                  <p className="text-sm font-medium text-[var(--text-2)]">
                    Noch keine Saisons angelegt
                  </p>
                  <p className="text-[0.75rem] text-[var(--muted)]">
                    Erstelle die erste Saison, um Teams und Events zu aktivieren.
                  </p>
                  <Link
                    href="/dashboard/seasons"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold text-[var(--blue)] transition-all hover:bg-[var(--blue-light)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Saison erstellen
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.allSeasons.slice(0, 4).map((season: SeasonOption) => (
                    <div
                      key={season.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background: season.shouldBeActive
                              ? "#10b981"
                              : "var(--border-strong)",
                          }}
                        />
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {season.name}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-medium"
                        style={{
                          background: season.shouldBeActive
                            ? "rgba(16,185,129,0.10)"
                            : "var(--surface-3)",
                          color: season.shouldBeActive
                            ? "#10b981"
                            : "var(--muted)",
                        }}
                      >
                        {season.lifecycleStatusLabel}
                      </span>
                    </div>
                  ))}
                  {data.allSeasons.length > 4 && (
                    <p className="px-3 pt-1 text-[0.72rem] text-[var(--muted)]">
                      + {data.allSeasons.length - 4} weitere Saisons
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Organisation overview */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="min-w-0 flex-1">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  Organisation
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Org Builder
                </p>
              </div>
              <Link
                href="/dashboard/org-units"
                className="flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-[var(--blue)] transition-opacity hover:opacity-70"
              >
                Verwalten
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="sce-detail-section-body">
              {data.orgUnitCount === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Building2
                    className="text-[var(--muted)]"
                    style={{ width: 28, height: 28 }}
                  />
                  <p className="text-sm font-medium text-[var(--text-2)]">
                    Noch keine Organisationseinheiten
                  </p>
                  <p className="text-[0.75rem] text-[var(--muted)]">
                    Der Org Builder bildet die Grundlage für Sichtbarkeit und
                    Governance.
                  </p>
                  <Link
                    href="/dashboard/org-units/new"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold text-[var(--blue)] transition-all hover:bg-[var(--blue-light)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Erste Einheit anlegen
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                      {data.orgUnitCount}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                      Aktive Organisationseinheiten
                    </p>
                  </div>
                  <Link
                    href="/dashboard/org-units/new"
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] shadow-[var(--shadow-xs)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Neue Einheit
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Governance overview */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="min-w-0 flex-1">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  Governance
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Rollen & Berechtigungen
                </p>
              </div>
              <Link
                href="/dashboard/roles"
                className="flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-[var(--blue)] transition-opacity hover:opacity-70"
              >
                Rollen
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="sce-detail-section-body">
              <div className="grid grid-cols-2 gap-4">
                <Link
                  href="/dashboard/roles"
                  className="group flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)] transition-all duration-150 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px]"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--blue-light)]">
                      <Shield className="h-3.5 w-3.5 text-[var(--blue)]" />
                    </div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Rollen
                    </p>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                    {data.roleCount}
                  </p>
                  <p className="text-[0.72rem] text-[var(--muted)]">
                    Systemrollen definiert
                  </p>
                </Link>

                <Link
                  href="/dashboard/permissions"
                  className="group flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)] transition-all duration-150 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px]"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--blue-light)]">
                      <KeyRound className="h-3.5 w-3.5 text-[var(--blue)]" />
                    </div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Berechtigungen
                    </p>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                    {data.permissionCount}
                  </p>
                  <p className="text-[0.72rem] text-[var(--muted)]">
                    Zugriffsrechte im System
                  </p>
                </Link>
              </div>
            </div>
          </div>

          {/* People & Teams row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                    Personen
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Stammdaten
                  </p>
                </div>
                <Link
                  href="/dashboard/persons"
                  className="flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-[var(--blue)] transition-opacity hover:opacity-70"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="sce-detail-section-body">
                {data.personCount === 0 ? (
                  <p className="text-[0.8rem] text-[var(--muted)]">
                    Noch keine Personen erfasst.
                  </p>
                ) : (
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                      {data.personCount}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                      Registrierte Stammdaten
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                    Teams
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Mannschaften
                  </p>
                </div>
                <Link
                  href="/dashboard/teams"
                  className="flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-[var(--blue)] transition-opacity hover:opacity-70"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="sce-detail-section-body">
                {data.teamCount === 0 ? (
                  <p className="text-[0.8rem] text-[var(--muted)]">
                    Noch keine Teams angelegt.
                  </p>
                ) : (
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                      {data.teamCount}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                      Teams gesamt
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Quick actions */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  Aktionen
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Schnellzugriff
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-2">
              <QuickActionButton
                href="/dashboard/users/new"
                icon={Shield}
                label="Benutzer einladen"
              />
              <QuickActionButton
                href="/dashboard/org-units/new"
                icon={Building2}
                label="Org-Einheit anlegen"
              />
              <QuickActionButton
                href="/dashboard/persons/new"
                icon={UserCircle2}
                label="Person erfassen"
              />
              <QuickActionButton
                href="/dashboard/teams/new"
                icon={Users}
                label="Team erstellen"
              />
              <QuickActionButton
                href="/dashboard/seasons"
                icon={CalendarRange}
                label="Saison einrichten"
              />
            </div>
          </div>

          {/* Quick links */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  Navigation
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Schnelllinks
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-0.5 pt-0 pb-1">
              <QuickLinkItem
                href="/dashboard/org-units"
                label="Organisation"
                count={data.orgUnitCount}
              />
              <QuickLinkItem
                href="/dashboard/users"
                label="Benutzer"
                count={data.userCount}
              />
              <QuickLinkItem
                href="/dashboard/roles"
                label="Rollen"
                count={data.roleCount}
              />
              <QuickLinkItem
                href="/dashboard/permissions"
                label="Berechtigungen"
                count={data.permissionCount}
              />
              <QuickLinkItem
                href="/dashboard/persons"
                label="Personen"
                count={data.personCount}
              />
              <QuickLinkItem
                href="/dashboard/teams"
                label="Teams"
                count={data.teamCount}
              />
              <QuickLinkItem
                href="/dashboard/seasons"
                label="Saisons"
                count={data.seasonCount}
              />
              <QuickLinkItem
                href="/dashboard"
                label="Dashboard"
              />
            </div>
          </div>

        </div>
      </div>

      {/* ── Onboarding progress ───────────────────────────────────────── */}
      <AdminOnboardingProgress steps={onboardingSteps} />

    </div>
  );
}
