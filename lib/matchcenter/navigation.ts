/**
 * lib/matchcenter/navigation.ts
 *
 * Shared URL builders and team-filter normalization for Matchcenter overview
 * navigation (tabs, month, status, wochenplan, team).
 */

import type {
  MatchcenterActionFilter,
  MatchcenterTab,
  MatchcenterWochenplanFilter,
} from "./view-model";

export type MatchcenterTeamOption = {
  id: string;
  label: string;
};

export type MatchcenterHrefParams = {
  tab: MatchcenterTab;
  month: string;
  actionFilter: MatchcenterActionFilter;
  wochenplanFilter: MatchcenterWochenplanFilter;
  teamFilter?: string | null;
};

/**
 * Builds a bookmarkable Matchcenter overview href. Omits default query values
 * (ALLE filters, no team) to keep URLs minimal.
 */
export function buildMatchcenterHref(
  basePath: string,
  params: MatchcenterHrefParams,
): string {
  const search = new URLSearchParams();
  search.set("tab", params.tab.toLowerCase());
  search.set("month", params.month);

  if (params.tab === "SPIELPLANUNG") {
    search.set("filter", params.actionFilter.toLowerCase());
  }

  if (params.wochenplanFilter !== "ALLE") {
    search.set("wochenplan", params.wochenplanFilter.toLowerCase());
  }

  if (params.teamFilter) {
    search.set("team", params.teamFilter);
  }

  return `${basePath}?${search.toString()}`;
}

/**
 * Resolves the `team` query param against tenant-scoped canonical team ids.
 * Unknown or cross-tenant ids are ignored (Alle Teams).
 */
export function normalizeMatchcenterTeamFilter(
  value: string | null | undefined,
  validTeamIds: ReadonlySet<string>,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  return validTeamIds.has(trimmed) ? trimmed : null;
}

export function toMatchcenterTeamOptions(
  teams: ReadonlyArray<{
    id: string;
    compactName: string | null;
    displayName?: string | null;
    name?: string | null;
  }>,
): MatchcenterTeamOption[] {
  return teams.map((team) => ({
    id: team.id,
    label: team.compactName ?? team.displayName ?? team.name ?? team.id,
  }));
}
