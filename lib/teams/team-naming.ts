/**
 * lib/teams/team-naming.ts
 *
 * TEAM-IDENTITY-01 — canonical Team naming contract.
 *
 * Defines ONE reusable naming-fallback contract for tenant-facing Team
 * naming (Teams admin UI: overview list, Team detail/edit). This is
 * intentionally separate from `lib/publishing/presentation/display-name-resolver.ts`,
 * which resolves TeamSeason.displayName/shortName for the (frozen)
 * Infoboard/Website publishing pipelines and must not be modified here.
 *
 * Mandatory model (tenant-owned, never overwritten by provider sync):
 *   - Team.name             — LONG NAME  (e.g. "FC Allschwil Junioren B2")
 *   - Team.shortName        — SHORT NAME (e.g. "B2")
 *   - Team.alternativeName  — ALTERNATIVE NAME (e.g. "Junioren B2")
 *
 * Provider identity (never a naming input, never used to merge/dedupe):
 *   - TeamExternalMapping.provider + externalTeamId + externalSeasonId
 *
 * Provider-owned display fallback (last resort only):
 *   - TeamExternalMapping.providerTeamName
 *
 * Fallback priority:
 *   Long contexts (e.g. Teams overview title, Team detail heading):
 *     TeamSeason.displayName → Team.name → Team.alternativeName → providerTeamName
 *
 *   Compact contexts (e.g. space-constrained badges/lists):
 *     Team.shortName → Team.name → Team.alternativeName → providerTeamName
 *
 * Design constraints:
 *   - Pure, synchronous, deterministic. No I/O, no DB access, no React.
 *   - Blank/whitespace-only strings are treated as absent.
 *   - Never merges, guesses, or auto-derives names from string parsing.
 *   - Returns null only when every candidate is absent — callers decide how
 *     to render that case (e.g. TENANT_NAMING_REQUIRED reporting).
 */

function meaningful(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstMeaningful(
  candidates: ReadonlyArray<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const value = meaningful(candidate);
    if (value !== undefined) return value;
  }
  return null;
}

/**
 * Structural input for the canonical Team naming contract.
 *
 * Verified schema fields only:
 *   - `teamSeasonDisplayName` → TeamSeason.displayName (seasonal override,
 *     when a relevant TeamSeason is in scope — omit when not applicable)
 *   - `teamName`              → Team.name (canonical long name)
 *   - `teamShortName`         → Team.shortName (canonical short name)
 *   - `teamAlternativeName`   → Team.alternativeName (canonical alternative name)
 *   - `providerTeamName`      → TeamExternalMapping.providerTeamName (last resort)
 */
export type TeamNamingInput = {
  readonly teamSeasonDisplayName?: string | null;
  readonly teamName?: string | null;
  readonly teamShortName?: string | null;
  readonly teamAlternativeName?: string | null;
  readonly providerTeamName?: string | null;
};

/**
 * Resolves the best tenant-facing LONG name for a Team.
 *
 * Priority: TeamSeason.displayName → Team.name → Team.alternativeName → providerTeamName
 *
 * Use for long/detail contexts: Teams overview row title, Team detail heading.
 */
export function resolveLongTeamName(input: TeamNamingInput): string | null {
  return firstMeaningful([
    input.teamSeasonDisplayName,
    input.teamName,
    input.teamAlternativeName,
    input.providerTeamName,
  ]);
}

/**
 * Resolves the best tenant-facing COMPACT name for a Team.
 *
 * Priority: Team.shortName → Team.name → Team.alternativeName → providerTeamName
 *
 * Use for space-constrained contexts: compact badges, secondary labels.
 */
export function resolveCompactTeamName(input: TeamNamingInput): string | null {
  return firstMeaningful([
    input.teamShortName,
    input.teamName,
    input.teamAlternativeName,
    input.providerTeamName,
  ]);
}
