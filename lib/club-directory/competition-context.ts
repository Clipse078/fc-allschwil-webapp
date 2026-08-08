/**
 * lib/club-directory/competition-context.ts
 *
 * CLUB-DIRECTORY-04 — External Team Competition Context.
 *
 * Pure, provider-agnostic helpers that turn an ExternalTeam's provider
 * mapping(s) into the secondary "sporting context" line shown next to its
 * canonical name in the Club Directory UI (e.g. "3. Liga · Gruppe 1").
 *
 * Design rules (never violated):
 *   - Reads ONLY real provider-reported fields (providerLeagueName /
 *     providerGroupName, refreshed by provider sync — see provider-sync.ts).
 *     Never invents, infers, or derives a value from the team's name.
 *   - NEVER reads or exposes providerTeamId / providerClubId / any other
 *     technical provider identifier — those stay internal (identity,
 *     sync, reconciliation only). See mutation-service.ts /
 *     query-service.ts for where those ids are used for exactly that,
 *     never for display.
 *   - Provider-neutral: operates on the generic providerLeagueName /
 *     providerGroupName fields already reserved on *every* provider's
 *     ExternalTeamProviderMapping row — nothing here is SFV-specific.
 *   - Degrades gracefully: renders whatever real context is available
 *     (league only, group only, both, or neither) — never a placeholder,
 *     never a fabricated value.
 */

export type ExternalTeamCompetitionContext = {
  leagueName: string | null;
  groupName: string | null;
};

const EMPTY_CONTEXT: ExternalTeamCompetitionContext = { leagueName: null, groupName: null };

type ProviderMappingContextSource = {
  providerLeagueName: string | null;
  providerGroupName: string | null;
  lastSyncedAt: Date | null;
};

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves the sporting context to display for an ExternalTeam from its
 * provider mapping row(s).
 *
 * An ExternalTeam normally has at most one provider mapping per provider
 * (SFV opponents are discovered "seasonless", see
 * ExternalTeamProviderMapping schema doc), but this stays defensive for the
 * general case (multiple providers, or explicit season-scoped mappings):
 * it picks the mapping with the most recently reported context (by
 * `lastSyncedAt`) among those that actually carry a league or group name,
 * and returns ITS pair together — league and group are never mixed across
 * two different mapping rows, so the result always reflects one provider's
 * one coherent, real report.
 *
 * Returns an all-null context when no mapping carries any real context yet
 * — the caller must render the team with no second line, never a
 * fabricated or technical-id fallback (see formatExternalTeamCompetitionContext).
 */
export function resolveExternalTeamCompetitionContext(
  mappings: readonly ProviderMappingContextSource[],
): ExternalTeamCompetitionContext {
  const withContext = mappings
    .map((mapping) => ({
      leagueName: normalize(mapping.providerLeagueName),
      groupName: normalize(mapping.providerGroupName),
      lastSyncedAt: mapping.lastSyncedAt,
    }))
    .filter((mapping) => mapping.leagueName !== null || mapping.groupName !== null);

  if (withContext.length === 0) {
    return EMPTY_CONTEXT;
  }

  const [freshest] = withContext.sort((a, b) => {
    const aTime = a.lastSyncedAt?.getTime() ?? 0;
    const bTime = b.lastSyncedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return { leagueName: freshest.leagueName, groupName: freshest.groupName };
}

/**
 * Formats a resolved competition context into the single secondary-line
 * string shown under the team name (e.g. "3. Liga · Gruppe 1", "3. Liga",
 * or null when no real context is available).
 *
 * Preferred order (per CLUB-DIRECTORY-04): league/competition first, then
 * competition group — mirrors the task's own worked examples. Only the
 * parts that actually have a real value are joined; nothing is invented to
 * fill a gap.
 */
export function formatExternalTeamCompetitionContext(
  context: ExternalTeamCompetitionContext,
): string | null {
  const parts = [context.leagueName, context.groupName].filter(
    (part): part is string => part !== null,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
