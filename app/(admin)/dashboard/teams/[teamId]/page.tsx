import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Globe, Monitor, Shield, Trophy, Users } from "lucide-react";
import TeamDetailCard from "@/components/admin/teams/TeamDetailCard";
import TeamLifecycleCard from "@/components/admin/teams/TeamLifecycleCard";
import TeamSeasonDeleteButton from "@/components/admin/teams/TeamSeasonDeleteButton";
import ScopedResponsibilitiesCard from "@/components/admin/shared/ScopedResponsibilitiesCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTeamDetailData } from "@/lib/teams/queries";
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
import { Badge, Card } from "@/components/ui";
import { SectionCard } from "@/components/ui/page";
import { PropertyGrid } from "@/components/ui/PropertyGrid";
import { TimelinePlaceholder } from "@/components/ui/TimelinePlaceholder";

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
  // legacy orgUnit as fallback — same logic as the property grid above.
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
  // TEAMCENTER-UX-01C: consume the canonical current-season TeamSeason
  // already resolved by getTeamDetailData — do not re-derive "which season
  // is current" here (that duplication was the root cause of this page
  // showing a different current season than the Teams list / TrainingCenter).
  const activeSeason =
    team.teamSeasons.find((ts) => ts.id === team.currentTeamSeasonId) ?? null;

  // TEAM-IDENTITY-01: canonical long-name fallback (lib/teams/team-naming.ts),
  // already resolved by getTeamDetailData. Team.name is the primary Team
  // identity — never substituted by a seasonal displayName/provider name.
  const displayTitle = team.displayName ?? team.name;

  // TEAMCENTER-UX-01B (C, I): one-line supporting metadata under the primary
  // header — shortName · category · Liga/Wettbewerb. Never repeats the Team
  // identity itself (that is the page title above).
  const competitionLabel = team.competition?.shortName ?? team.competition?.name ?? null;
  const metaLine = [
    team.shortName && team.shortName !== displayTitle ? team.shortName : null,
    categoryLabel,
    competitionLabel ?? "Kein Wettbewerb",
  ]
    .filter(Boolean)
    .join(" · ");

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
        summary={
          <Card variant="section" noPadding>
            <div className="px-5 py-4">
              <PropertyGrid
                items={[
                  { label: "Kategorie", value: categoryLabel },
                  {
                    label: "Aktive Saison",
                    value: activeSeason?.season.name,
                    icon: <Calendar className="h-3.5 w-3.5" />,
                    emptyText: "Keine aktive Saison",
                  },
                  {
                    label: "Saisoneinträge",
                    value: `${team.teamSeasons.length}`,
                    icon: <Shield className="h-3.5 w-3.5" />,
                  },
                  {
                    // TEAM-SEASON-ORGUNIT-01: show canonical season OrgUnit;
                    // fall back to legacy orgUnit when no season assignment exists.
                    label: "Organisationseinheit",
                    value: team.currentSeasonOrgUnit?.name ?? team.orgUnit?.name,
                    href: (team.currentSeasonOrgUnit ?? team.orgUnit)
                      ? `/dashboard/org-units/${(team.currentSeasonOrgUnit ?? team.orgUnit)!.id}`
                      : undefined,
                    icon: <Building2 className="h-3.5 w-3.5" />,
                    emptyText: "Keine Einheit verknüpft",
                  },
                  {
                    label: "Website",
                    value: team.websiteVisible ? "Sichtbar" : "Versteckt",
                    icon: <Globe className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Infoboard",
                    value: team.infoboardVisible ? "Sichtbar" : "Versteckt",
                    icon: <Monitor className="h-3.5 w-3.5" />,
                  },
                ]}
                columns={3}
              />
            </div>
          </Card>
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

            {activeSeason ? (
              <SectionCard title="Saison">
                <PropertyGrid
                  items={[{ label: "Saison", value: activeSeason.season.name }]}
                  columns={1}
                />
              </SectionCard>
            ) : null}

            {activeSeason ? (
              <SectionCard title="Teilnahme">
                <PropertyGrid
                  items={[
                    {
                      label: "Teilnahmetyp",
                      value:
                        PARTICIPATION_TYPE_LABELS[
                          activeSeason.participationType
                        ] ?? activeSeason.participationType,
                      icon: <Trophy className="h-3.5 w-3.5" />,
                    },
                  ]}
                  columns={1}
                />
              </SectionCard>
            ) : null}
            <SectionCard title="Kader & Stab">
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>
                  {team.teamSeasons.length > 0
                    ? `${team.teamSeasons.length} Saison${team.teamSeasons.length !== 1 ? "en" : ""} mit Kader & Stab`
                    : "Noch kein Kader erfasst."}
                </span>
              </div>
            </SectionCard>

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
            <TimelinePlaceholder />
          </>
        }
      >
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

        {/* ORG-ACCESS-02: Personen & Zuständigkeiten for this team's OrgUnit. */}
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
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Personen &amp; Zuständigkeiten
                </p>
              </div>
            </div>
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[var(--muted)]">
                Kein Bereich zugeordnet. Zuerst eine Organisationseinheit verknüpfen.
              </p>
            </div>
          </div>
        )}

        {/* PERSON-UX-07: Stable anchor target for precision CTA from Person workspace.
         * Player roster section — /dashboard/teams/:teamId#spielerkader */}
        <section
          id="spielerkader"
          className="scroll-mt-20 rounded-xl border border-[var(--border)] bg-[var(--surface)] target:ring-2 target:ring-inset target:ring-[var(--sce-primary)]"
          aria-label="Spielerkader"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4">
            <Users className="h-4 w-4 text-[var(--sce-primary)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Spielerkader
            </p>
            {activeSeason ? (
              <span className="ml-auto inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sce-primary)]">
                {activeSeason.season.name}
              </span>
            ) : null}
          </div>
          <div className="px-5 py-4">
            {activeSeason ? (
              <p className="text-sm text-[var(--muted)]">
                Spielerkader-Verwaltung für die Saison {activeSeason.season.name}.
                Kader-Zuordnungen werden hier hinterlegt und verwaltet.
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Noch keine aktive Saison vorhanden. Für die Kader-Verwaltung wird eine Team-Saison benötigt.
              </p>
            )}
          </div>
        </section>

        {/* PERSON-UX-07: Stable anchor target for precision CTA from Person workspace.
         * Trainer team section — /dashboard/teams/:teamId#trainerteam */}
        <section
          id="trainerteam"
          className="scroll-mt-20 rounded-xl border border-[var(--border)] bg-[var(--surface)] target:ring-2 target:ring-inset target:ring-[var(--sce-primary)]"
          aria-label="Trainerteam"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4">
            <Users className="h-4 w-4 text-[var(--sce-primary)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Trainerteam
            </p>
            {activeSeason ? (
              <span className="ml-auto inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sce-primary)]">
                {activeSeason.season.name}
              </span>
            ) : null}
          </div>
          <div className="px-5 py-4">
            {activeSeason ? (
              <p className="text-sm text-[var(--muted)]">
                Trainerteam-Verwaltung für die Saison {activeSeason.season.name}.
                Trainer-Zuordnungen werden hier hinterlegt und verwaltet.
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Noch keine aktive Saison vorhanden. Für die Trainerteam-Verwaltung wird eine Team-Saison benötigt.
              </p>
            )}
          </div>
        </section>
      </DetailPagePattern>
    </PageShell>
  );
}
