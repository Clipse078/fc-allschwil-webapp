/**
 * lib/publishing/presentation/display-name-resolver.ts
 *
 * Pure, synchronous, deterministic display-name resolvers for publishing feeds.
 *
 * Resolves:
 *   - team display names (INFOBOARD / WEBSITE channels)
 *   - opponent display names (INFOBOARD / WEBSITE channels)
 *   - competition labels
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No environment variable access, no time access, no logging.
 *   - Null is returned when no meaningful value exists.
 *   - No placeholders ("-", "Unknown", "TBD", etc.) are ever generated.
 *   - Inputs are never mutated.
 *
 * Inventory notes — missing proposed fields (absent from real schema):
 *   Team:
 *     - No `officialName`, `websiteName`, or `infoboardName` on Team or TeamSeason.
 *     - TeamSeason has `displayName` (required) and `shortName` (optional) —
 *       used by the WEBSITE channel only; INFOBOARD uses tenant-managed Team
 *       fields (INFOBOARD-TEAMNAME-01).
 *   Event:
 *     - No `categoryLabel` on the Event model. Only `competitionLabel` exists.
 */

import { resolveInfoboardTeamDisplayName } from "./infoboard-team-display-name";

// ── Presentation channel ───────────────────────────────────────────────────────

/**
 * Presentation channel used to select the appropriate display-name priority.
 *
 * Intentionally distinct from PublicationChannel (lib/publishing/policy/).
 * Presentation naming and publication eligibility are separate concerns.
 */
export type PresentationChannel = "INFOBOARD" | "WEBSITE";

// ── Private normalization helper ───────────────────────────────────────────────

/**
 * Returns the trimmed string if non-blank, or undefined.
 * Treats whitespace-only strings as absent.
 * Preserves internal whitespace and capitalization.
 * Does not mutate the input.
 */
function meaningful(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Returns the first meaningful (non-blank, trimmed) candidate from the list,
 * or null when all candidates are absent or blank.
 */
function firstMeaningful(
  candidates: ReadonlyArray<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const value = meaningful(candidate);
    if (value !== undefined) return value;
  }
  return null;
}

// ── Team display name ──────────────────────────────────────────────────────────

/**
 * Structural input for team display-name resolution.
 *
 * Verified schema fields only — fields absent from the real schema are omitted:
 *   - `name`            → Team.name (tenant-managed canonical long name)
 *   - `shortName`       → Team.shortName (tenant-managed compact name)
 *   - `alternativeName` → Team.alternativeName (tenant-managed alternative)
 *   - `infoboardDisplayName` → Team.infoboardDisplayName (Infoboard override)
 *   - `displayName`     → TeamSeason.displayName (season-scoped; WEBSITE only)
 *   - `fallbackName`    → explicit source-event fallback (e.g. raw team title from
 *                         event import); not a schema field.
 *
 * Missing proposed fields (not invented):
 *   - `infoboardName` — does not exist on Team or TeamSeason.
 *   - `websiteName`   — does not exist on Team or TeamSeason.
 *   - `officialName`  — does not exist on Team or TeamSeason.
 */
export type TeamDisplayNameInput = {
  readonly name?: string | null;
  readonly displayName?: string | null;
  readonly shortName?: string | null;
  readonly alternativeName?: string | null;
  readonly infoboardDisplayName?: string | null;
  readonly fallbackName?: string | null;
};

/**
 * Resolves the best team display name for the given presentation channel.
 *
 * INFOBOARD — tenant-managed Team identity (INFOBOARD-TEAMNAME-01):
 *   Reuses resolveInfoboardTeamDisplayName() from infoboard-team-display-name.ts:
 *   1. Team.infoboardDisplayName
 *   2. Team.alternativeName
 *   3. Team.shortName
 *   4. Team.name
 *   5. fallbackName (explicit source-event fallback)
 *
 *   TeamSeason.displayName / TeamSeason.shortName are intentionally excluded —
 *   seasonal overrides must not substitute for tenant-managed Team fields.
 *
 * WEBSITE — canonical tenant-managed Team identity (TEAM-IDENTITY-01 /
 * TEAMCENTER-UX-01B), aligned with resolveLongTeamName():
 *   1. name        (Team.name — canonical tenant-managed long name)
 *   2. displayName (TeamSeason.displayName — seasonal fallback only)
 *   3. shortName   (TeamSeason.shortName — abbreviated, last resort)
 *   4. fallbackName (explicit source-event fallback)
 *
 * TeamSeason.displayName must never override a present Team.name — stale
 * seasonal rows (e.g. after a rename or provider drift) must not leak E4
 * when the canonical Team identity is E2.
 *
 * Note: No infoboardName or websiteName field exists on Team or TeamSeason.
 * The priority reflects the reduced verified field set.
 *
 * Blank candidates are skipped; the next priority is tried.
 * Returns null when no meaningful value exists across all candidates.
 */
export function resolveTeamDisplayName(
  input: TeamDisplayNameInput,
  channel: PresentationChannel,
): string | null {
  if (channel === "INFOBOARD") {
    return resolveInfoboardTeamDisplayName({
      infoboardDisplayName: input.infoboardDisplayName,
      alternativeName: input.alternativeName,
      shortName: input.shortName,
      name: input.name,
      fallbackName: input.fallbackName,
    });
  }

  return firstMeaningful([
    input.name,
    input.displayName,
    input.shortName,
    input.fallbackName,
  ]);
}

// ── Opponent display name ──────────────────────────────────────────────────────

/**
 * Structural input for opponent display-name resolution.
 *
 * Verified schema fields from the Opponent model:
 *   - `officialName`  → Opponent.officialName (required on model, optional here)
 *   - `shortName`     → Opponent.shortName
 *   - `websiteName`   → Opponent.websiteName
 *   - `infoboardName` → Opponent.infoboardName
 *   - `fallbackName`  → explicit source-event fallback (e.g. Event.opponentName)
 */
export type OpponentDisplayNameInput = {
  readonly officialName?: string | null;
  readonly shortName?: string | null;
  readonly websiteName?: string | null;
  readonly infoboardName?: string | null;
  readonly fallbackName?: string | null;
};

/**
 * Resolves the best opponent display name for the given presentation channel.
 *
 * INFOBOARD:
 *   1. infoboardName  (Opponent.infoboardName)
 *   2. shortName      (Opponent.shortName)
 *   3. officialName   (Opponent.officialName)
 *   4. fallbackName   (explicit source-event fallback)
 *
 * WEBSITE:
 *   1. websiteName    (Opponent.websiteName)
 *   2. officialName   (Opponent.officialName)
 *   3. shortName      (Opponent.shortName)
 *   4. fallbackName   (explicit source-event fallback)
 *
 * Blank configured names are skipped; the next priority is tried.
 * Returns null when no meaningful value exists across all candidates.
 */
export function resolveOpponentDisplayName(
  input: OpponentDisplayNameInput,
  channel: PresentationChannel,
): string | null {
  if (channel === "INFOBOARD") {
    return firstMeaningful([
      input.infoboardName,
      input.shortName,
      input.officialName,
      input.fallbackName,
    ]);
  }

  return firstMeaningful([
    input.websiteName,
    input.officialName,
    input.shortName,
    input.fallbackName,
  ]);
}

// ── Competition display ────────────────────────────────────────────────────────

/**
 * Structural input for competition display resolution.
 *
 * Verified schema fields from the Event model:
 *   - `competitionLabel` → Event.competitionLabel (only competition field on Event)
 *   - `fallbackLabel`    → explicit caller-provided fallback; not a schema field.
 *
 * Missing proposed field (not invented):
 *   - `categoryLabel` — does not exist on the Event model.
 */
export type CompetitionDisplayInput = {
  readonly competitionLabel?: string | null;
  readonly fallbackLabel?: string | null;
};

/**
 * Resolves the competition display label.
 *
 * Priority:
 *   1. competitionLabel (Event.competitionLabel)
 *   2. fallbackLabel    (explicit caller-provided fallback)
 *
 * Note: No categoryLabel exists on the Event schema. The reduced priority
 * reflects the single verified field.
 *
 * Values are not translated, concatenated, or inferred from event type.
 * Returns null when no meaningful value exists.
 */
export function resolveCompetitionDisplay(
  input: CompetitionDisplayInput,
): string | null {
  return firstMeaningful([input.competitionLabel, input.fallbackLabel]);
}
