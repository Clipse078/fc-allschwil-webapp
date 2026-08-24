/**
 * lib/publishing/presentation/infoboard-team-display-name.ts
 *
 * INFOBOARD-TEAMNAME-01 — canonical Infoboard Screen 1 team display-name
 * resolver for tenant-managed Teams.
 *
 * Priority:
 *   1. Team.infoboardDisplayName
 *   2. Team.alternativeName
 *   3. Team.shortName
 *   4. Team.name
 *   5. fallbackName (explicit source-event fallback when canonical Team
 *      identity is unavailable)
 *
 * Design constraints:
 *   - Pure, synchronous, deterministic. No I/O, no DB access, no React.
 *   - Blank/whitespace-only strings are treated as absent.
 *   - TeamSeason.displayName / TeamSeason.shortName are intentionally excluded.
 *   - Never mutates inputs.
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

export type InfoboardTeamDisplayNameInput = {
  readonly infoboardDisplayName?: string | null;
  readonly alternativeName?: string | null;
  readonly shortName?: string | null;
  readonly name?: string | null;
  readonly fallbackName?: string | null;
};

/**
 * Resolves the tenant-managed Team display name for Infoboard Screen 1.
 */
export function resolveInfoboardTeamDisplayName(
  input: InfoboardTeamDisplayNameInput,
): string | null {
  return firstMeaningful([
    input.infoboardDisplayName,
    input.alternativeName,
    input.shortName,
    input.name,
    input.fallbackName,
  ]);
}
