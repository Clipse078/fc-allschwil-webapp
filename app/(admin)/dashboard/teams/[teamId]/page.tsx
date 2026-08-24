import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import TeamDetailCard from "@/components/admin/teams/TeamDetailCard";
import TeamCockpitOverview from "@/components/admin/teams/TeamCockpitOverview";
import TeamLifecycleCard from "@/components/admin/teams/TeamLifecycleCard";
import TeamSeasonDeleteButton from "@/components/admin/teams/TeamSeasonDeleteButton";
import ScopedResponsibilitiesCard from "@/components/admin/shared/ScopedResponsibilitiesCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTeamDetailData } from "@/lib/teams/queries";
import { buildTeamCockpitMetrics } from "@/lib/teams/team-cockpit-metrics";
import { getOrgUnits } from "@/lib/org/queries";
import { getEligibleCompetitions } from "@/lib/competitions/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getEligibleTenantMembers } from "@/lib/roles/tenant-queries";
import {
  getScopedAssignmentsForOrgUnit,
} from "@/lib/roles/scoped-mutations";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { prisma } from "@/lib/db/prisma";
import { PageShell } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge } from "@/components/ui";
import { SectionCard } from "@/components/ui/page";

const CATEGORY_LABELS: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
};

const PARTICIPATION_TYPE_LABELS: Record<string, string> = {
  COMPETITION: "Wettkampfteam",
  TRAINING: "Trainingsgruppe",
  DEVELOPMENT: "Entwicklungsteam",
  RECREATIONAL: "Freizeitteam",
  OTHER: "Sonstiges",
};

type Props = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
    // ADMIN-DELETE-01B: a delegated user may hold teams.delete without
    // teams.view/teams.manage — they must still be able to reach this page
    // to exercise the permanent-delete action gated below.
    PERMISSIONS.TEAMS_DELETE,
  ]);

  const canManage = hasPermission(session, PERMISSIONS.TEAMS_MANAGE);
  // ADMIN-DELETE-01B: permanent "Löschen" gating — deliberately independent
  // of canManage (teams.manage alone must never authorize deletion, and a
  // delegated teams.delete-only grant must not require teams.manage either).
  const canDelete = hasPermission(session, PERMISSIONS.TEAMS_DELETE);
  const { teamId } = await params;

  const tenant = await getActiveTenant();
  if (!tenant) {
    notFound();
  }
  const tenantId = tenant.id;

  const [team, availableOrgUnits, availableCompetitions] = await Promise.all([
    getTeamDetailData(tenantId, teamId),
    getOrgUnits(tenantId),
    getEligibleCompetitions(tenantId),
  ]);

  if (!team) {
    notFound();
  }

  // ORG-ACCESS-02: resolve the team's canonical OrgUnit for scoped assignments.
  // Uses the canonical current-season OrgUnit (TEAM-SEASON-ORGUNIT-01) with
  // legacy orgUnit as fallback.
  const teamOrgUnit = team.currentSeasonOrgUnit ?? team.orgUnit ?? null;
  const teamOrgUnitId = teamOrgUnit?.id ?? null;

  const [teamScopedAssignments, teamEligibleUsers, teamRolesForResponsibilities] =
    teamOrgUnitId
      ? await Promise.all([
          getScopedAssignmentsForOrgUnit(tenantId, teamOrgUnitId),
          getEligibleTenantMembers(tenantId),
          prisma.role.findMany({
            where: {
              scope: "TENANT",
              tenantId,
              isArchived: false,
              key: { not: getTenantClubAdminRoleKey(tenant.key) },
            },
            orderBy: { name: "asc" },
            select: { id: true, key: true, name: true, isSystem: true },
          }),
        ])
      : [[], [], []];

  const categoryLabel = CATEGORY_LABELS[team.category] ?? team.category;
  const activeSeason =
    team.teamSeasons.find((ts) => ts.id === team.currentTeamSeasonId) ?? null;

  const displayTitle = team.displayName ?? team.name;
  const competitionLabel = team.competition?.shortName ?? team.competition?.name ?? null;
  const metaLine = [
    team.shortName && team.shortName !== displayTitle ? team.shortName : null,
    categoryLabel,
    activeSeason?.season.name,
    competitionLabel ?? "Kein Wettbewerb",
  ]
    .filter(Boolean)
    .join(" · ");

  const cockpitMetrics = buildTeamCockpitMetrics({
    team,
    categoryLabels: CATEGORY_LABELS,
    participationTypeLabels: PARTICIPATION_TYPE_LABELS,
  });

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Teams"
        title={displayTitle}
        description={metaLine}
        headerBadge={
          <Badge variant={team.isActive ? "success" : "outline"}>
            {team.isActive ? "Aktiv" : "Archiviert"}
          </Badge>
        }
        breadcrumbs={[
          { label: "Teams", href: "/dashboard/teams" },
          { label: displayTitle },
        ]}
        headerActions={
          <Link
            href="/dashboard/teams"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zu Teams
          </Link>
        }
        sidebar={
          <>
            <TeamLifecycleCard
              teamId={team.id}
              teamName={displayTitle}
              isActive={team.isActive}
              canManage={canManage}
              canDelete={canDelete}
            />

            {canDelete && team.teamSeasons.length > 0 ? (
              <SectionCard title="Saisonen verwalten">
                <div className="space-y-2">
                  {team.teamSeasons.map((ts) => (
                    <div
                      key={ts.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--foreground)]">
                          {ts.displayName}
                        </p>
                        <p className="text-[0.7rem] text-[var(--muted)]">{ts.season.name}</p>
                      </div>
                      <TeamSeasonDeleteButton
                        teamId={team.id}
                        teamSeasonId={ts.id}
                        teamSeasonName={ts.displayName}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}
          </>
        }
      >
        <TeamCockpitOverview metrics={cockpitMetrics} />

        {/* TEAM-COCKPIT-02: future sport-data slot (matches, results, standings). */}

        <TeamDetailCard
          initialTeam={team}
          availableOrgUnits={availableOrgUnits.map((ou) => ({
            id: ou.id,
            name: ou.name,
            key: ou.key,
            type: ou.type,
          }))}
          availableCompetitions={availableCompetitions.map((c) => ({
            id: c.id,
            officialName: c.officialName,
            shortName: c.shortName,
          }))}
          canManage={canManage}
        />

        {/* ORG-ACCESS-02: scoped UserRole assignments — distinct from roster membership. */}
        {teamOrgUnitId ? (
          <ScopedResponsibilitiesCard
            orgUnitId={teamOrgUnitId}
            orgUnitName={teamOrgUnit!.name}
            initialAssignments={teamScopedAssignments}
            availableRoles={teamRolesForResponsibilities}
            eligibleUsers={teamEligibleUsers}
            showScopeModeSelector={false}
            canManage={canManage}
          />
        ) : (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Personen &amp; Zuständigkeiten
              </p>
            </div>
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-[var(--muted)]">
                Organisatorische Zuständigkeiten erfordern eine verknüpfte
                Organisationseinheit. Dies ist getrennt von Spielerkader und
                Trainerteam.
              </p>
            </div>
          </div>
        )}
      </DetailPagePattern>
    </PageShell>
  );
}
