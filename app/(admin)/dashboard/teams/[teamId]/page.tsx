import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Globe, Monitor, Shield, Users } from "lucide-react";
import TeamDetailCard from "@/components/admin/teams/TeamDetailCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTeamDetailData } from "@/lib/teams/queries";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import { getOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";

const CATEGORY_LABELS: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
};

function VisibilityBadge({ label, active, icon }: { label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white/10 text-white/60"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

type Props = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  const canManage = hasPermission(session, PERMISSIONS.TEAMS_MANAGE);
  const { teamId } = await params;

  const tenant = await getTenantFromSession(session.user?.tenantId);
  const [team, availableSeasons, availableOrgUnits] = await Promise.all([
    getTeamDetailData(teamId),
    getSeasonOptionsData(),
    getOrgUnits(tenant?.id),
  ]);

  if (!team) {
    notFound();
  }

  const categoryLabel = CATEGORY_LABELS[team.category] ?? team.category;
  const activeSeason =
    team.teamSeasons.find((ts) => ts.season.isActive) ??
    team.teamSeasons[0] ??
    null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="sce-entity-hero">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {/* Team avatar */}
            <div className="sce-avatar-xl">
              {team.ageGroup ?? (team.name.slice(0, 2).toUpperCase())}
            </div>

            {/* Identity */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                {categoryLabel}
              </p>
              <h1
                className="mt-1 text-2xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
              >
                {activeSeason?.displayName ?? team.name}
              </h1>
              {activeSeason?.displayName !== team.name ? (
                <p className="mt-0.5 text-sm text-white/60">{team.name}</p>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <AdminStatusPill
                  label={team.isActive ? "Aktiv" : "Inaktiv"}
                  tone={team.isActive ? "success" : "muted"}
                />
                {activeSeason ? (
                  <span className="fca-pill-year">
                    {activeSeason.season.name}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <VisibilityBadge
                label="Website"
                active={team.websiteVisible}
                icon={<Globe className="h-3 w-3" />}
              />
              <VisibilityBadge
                label="Infoboard"
                active={team.infoboardVisible}
                icon={<Monitor className="h-3 w-3" />}
              />
            </div>
            <Link
              href="/dashboard/teams"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zu Teams
            </Link>
          </div>
        </div>

        {/* Quick stats bar */}
        {team.teamSeasons.length > 0 ? (
          <div className="relative z-10 mt-6 flex flex-wrap gap-6 border-t border-white/15 pt-4">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Shield className="h-4 w-4 text-white/60" />
              <span className="font-semibold text-white">{team.teamSeasons.length}</span>
              <span>Saisoneintrag{team.teamSeasons.length !== 1 ? "e" : ""}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Users className="h-4 w-4 text-white/60" />
              <span>Kader & Trainerteam in den Saisons geführt</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Organisation unit link */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Organisationseinheit
            </p>
          </div>
        </div>
        <div className="sce-detail-section-body">
          {team.orgUnit ? (
            <Link
              href={`/dashboard/org-units/${team.orgUnit.id}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--blue)] hover:underline"
            >
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              {team.orgUnit.name}
              <code className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.72rem] font-mono text-[var(--muted)]">
                {team.orgUnit.key}
              </code>
            </Link>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No organisation unit linked yet.
            </p>
          )}
        </div>
      </div>

      {/* Management card stack */}
      <TeamDetailCard
        initialTeam={team}
        availableSeasons={availableSeasons}
        availableOrgUnits={availableOrgUnits.map(ou => ({
          id: ou.id,
          name: ou.name,
          key: ou.key,
          type: ou.type,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
