/**
 * lib/teams/team-naming.ts
 *
 * TEAM-IDENTITY-01 — canonical Team naming contract.
 *
 * Defines ONE reusable naming-fallback contract for tenant-facing Team
 * naming (Teams admin UI: overview list, Team detail/edit). Publishing
 * INFOBOARD team display names use resolveInfoboardTeamDisplayName() via
 * display-name-resolver.ts (INFOBOARD-TEAMNAME-01). WEBSITE channel naming
 * still resolves TeamSeason.displayName/shortName in display-name-resolver.ts.
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
 * TEAMCENTER-UX-01B: Team.name is the canonical tenant-managed Team identity.
 * It MUST be the primary value shown everywhere the Team's name is rendered
 * (Teams overview row title, Team detail heading) — a seasonal
 * TeamSeason.displayName override (which may drift out of sync, e.g. a
 * provider re-sync that only touches the current season row) must never
 * substitute for it while Team.name is present. TeamSeason.displayName is
 * only consulted as a fallback when the canonical Team fields are absent.
 *
 * Fallback priority:
 *   Long contexts (e.g. Teams overview title, Team detail heading):
 *     Team.name → TeamSeason.displayName → Team.alternativeName → providerTeamName
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
 * Priority: Team.name → TeamSeason.displayName → Team.alternativeName → providerTeamName
 *
 * TEAMCENTER-UX-01B: Team.name is the canonical, tenant-managed identity and
 * must win whenever it is present — it is never substituted by a seasonal
 * TeamSeason.displayName override, a provider/SFV name, or any generated
 * category/stage name. Use for long/detail contexts: Teams overview row
 * title, Team detail heading.
 */
export function resolveLongTeamName(input: TeamNamingInput): string | null {
  return firstMeaningful([
    input.teamName,
    input.teamSeasonDisplayName,
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
