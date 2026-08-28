import { cache } from "react";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import type { TenantContext } from "@/lib/tenants/context";
import { getTeamDetailData } from "@/lib/teams/queries";
import { formatTeamCompetitionDisplayLabel } from "@/lib/teams/team-competition-display";

export const TEAM_COCKPIT_CATEGORY_LABELS: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
};

export const TEAM_COCKPIT_PARTICIPATION_TYPE_LABELS: Record<string, string> = {
  COMPETITION: "Wettkampfteam",
  TRAINING: "Trainingsgruppe",
  DEVELOPMENT: "Entwicklungsteam",
  RECREATIONAL: "Freizeitteam",
  OTHER: "Sonstiges",
};

const getCachedTeamDetailData = cache(getTeamDetailData);

export type TeamCockpitTeam = NonNullable<
  Awaited<ReturnType<typeof getTeamDetailData>>
>;

export type TeamCockpitAccess = {
  tenantId: string;
  tenantKey: string;
  tenant: TenantContext;
  team: TeamCockpitTeam;
  canManage: boolean;
  canDelete: boolean;
};

/**
 * Shared Team Cockpit authorization + tenant-scoped team lookup.
 * Nested routes must call this (or layout that calls it) — never bypass.
 */
export async function requireTeamCockpitAccess(
  teamId: string,
): Promise<TeamCockpitAccess> {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
    PERMISSIONS.TEAMS_DELETE,
  ]);

  const tenant = await getActiveTenant();
  if (!tenant) {
    notFound();
  }

  const team = await getCachedTeamDetailData(tenant.id, teamId);
  if (!team) {
    notFound();
  }

  return {
    tenantId: tenant.id,
    tenantKey: tenant.key,
    tenant,
    team,
    canManage: hasPermission(session, PERMISSIONS.TEAMS_MANAGE),
    canDelete: hasPermission(session, PERMISSIONS.TEAMS_DELETE),
  };
}

export function buildTeamCockpitDisplayTitle(team: TeamCockpitTeam): string {
  return team.displayName ?? team.name;
}

export function buildTeamCockpitMetaLine(team: TeamCockpitTeam): string {
  const categoryLabel =
    TEAM_COCKPIT_CATEGORY_LABELS[team.category] ?? team.category;
  const displayTitle = buildTeamCockpitDisplayTitle(team);
  const activeSeason =
    team.teamSeasons.find((ts) => ts.id === team.currentTeamSeasonId) ?? null;
  const competitionLabel = formatTeamCompetitionDisplayLabel(team.competition);

  return [
    team.shortName && team.shortName !== displayTitle ? team.shortName : null,
    categoryLabel,
    activeSeason?.season.name ??
      (team.teamSeasons.length > 0
        ? "Keine Saison im aktuellen Geschäftsjahr"
        : "Keine Saison"),
    competitionLabel ?? "Kein Wettbewerb",
  ]
    .filter(Boolean)
    .join(" · ");
}
