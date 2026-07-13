/**
 * lib/integrations/sfv/sync/team-mapper.ts
 *
 * Pure mapping functions: SFV TeamDetail → canonical Team / TeamExternalMapping fields.
 *
 * No side effects. No database access. No SFV client calls.
 * All functions are deterministic given the same input.
 *
 * Field ownership:
 *   SFV-owned (stored on TeamExternalMapping, updated every sync):
 *     providerTeamName, providerLeagueId, providerLeagueName,
 *     providerOrganisationId, providerIsActive, lastSyncedAt
 *
 *   Locally managed (set only on Team creation, never overwritten by sync):
 *     name, slug, category, genderGroup, ageGroup, sortOrder,
 *     websiteVisible, infoboardVisible, orgUnitId
 *
 * This separation ensures that admins can rename, recategorize, or reorganise
 * locally managed teams without those changes being overwritten by a sync.
 */

import type { TeamDetail } from "../client";
import type { SfvTeamSyncContext } from "./types";

// ── TeamCategory inference ─────────────────────────────────────────────────────

type InferredCategory =
  | "KINDERFUSSBALL"
  | "JUNIOREN"
  | "AKTIVE"
  | "FRAUEN"
  | "SENIOREN"
  | "TRAININGSGRUPPE";

/**
 * Infers a TeamCategory from SFV league/team name strings.
 *
 * SFV does not provide a structured category field. This inference is
 * best-effort based on league/team name patterns. Admins may recategorize
 * locally after the first sync.
 *
 * Pattern matching is case-insensitive.
 */
export function inferTeamCategory(
  teamName: string | null,
  leagueName: string | null,
): InferredCategory {
  const combined = `${teamName ?? ""} ${leagueName ?? ""}`.toLowerCase();

  if (
    combined.includes("kinder") ||
    combined.includes("bambini") ||
    combined.includes("mini")
  ) {
    return "KINDERFUSSBALL";
  }

  if (
    combined.includes("junioren") ||
    combined.includes("junior") ||
    combined.includes(" u8 ") ||
    combined.includes(" u9 ") ||
    combined.includes(" u10 ") ||
    combined.includes(" u11 ") ||
    combined.includes(" u12 ") ||
    combined.includes(" u13 ") ||
    combined.includes(" u14 ") ||
    combined.includes(" u15 ") ||
    combined.includes(" u16 ") ||
    combined.includes(" u17 ") ||
    combined.includes(" u18 ") ||
    combined.includes(" u19 ") ||
    combined.includes(" u20 ") ||
    combined.includes("-u8") ||
    combined.includes("-u9") ||
    combined.includes("-u10") ||
    combined.includes("-u11") ||
    combined.includes("-u12") ||
    combined.includes("-u13") ||
    combined.includes("-u14") ||
    combined.includes("-u15") ||
    combined.includes("-u16") ||
    combined.includes("-u17") ||
    combined.includes("-u18") ||
    combined.includes("-u19") ||
    combined.includes("-u20")
  ) {
    return "JUNIOREN";
  }

  if (
    combined.includes("frauen") ||
    combined.includes("damen") ||
    combined.includes("women") ||
    combined.includes("ladies")
  ) {
    return "FRAUEN";
  }

  if (combined.includes("senioren") || combined.includes("veteran")) {
    return "SENIOREN";
  }

  return "AKTIVE";
}

// ── Slug generation ────────────────────────────────────────────────────────────

/**
 * Generates a stable, URL-safe slug for a team imported from SFV.
 *
 * Format: sfv-{externalTeamId}
 *
 * SFV teamIds are unique across all clubs in the SFV system, making this slug
 * globally unique within SportClubEvo (which runs a single shared schema).
 *
 * The slug is set only on first Team creation and is not updated by subsequent
 * syncs — admins may rename slugs locally.
 */
export function buildSfvTeamSlug(externalTeamId: number): string {
  return `sfv-${externalTeamId}`;
}

// ── Team creation fields ───────────────────────────────────────────────────────

/**
 * Fields to set when creating a new canonical Team from an SFV TeamDetail.
 *
 * Only called on first import (no prior mapping exists).
 * After creation, Team fields are locally managed — never overwritten by sync.
 */
export function buildNewTeamFields(
  detail: TeamDetail,
  context: SfvTeamSyncContext,
): {
  name: string;
  slug: string;
  category: InferredCategory;
  tenantId: string;
  isActive: boolean;
} {
  const displayName = detail.teamFullname ?? detail.teamName ?? `SFV-Team ${detail.teamId}`;

  return {
    name: displayName,
    slug: buildSfvTeamSlug(detail.teamId),
    category: inferTeamCategory(detail.teamName, detail.teamLeagueName),
    tenantId: context.tenantId,
    isActive: true,
  };
}

// ── Mapping upsert fields ──────────────────────────────────────────────────────

/**
 * Fields to write to TeamExternalMapping from an SFV TeamDetail.
 *
 * These are SFV-owned fields. They are written on both first creation and
 * subsequent syncs. They never touch locally managed Team fields.
 */
export function buildMappingFields(
  detail: TeamDetail,
  context: SfvTeamSyncContext,
): {
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  providerLeagueId: number;
  providerLeagueName: string | null;
  providerOrganisationId: number;
  providerIsActive: boolean;
  lastSyncedAt: Date;
} {
  return {
    provider: "SFV",
    externalTeamId: detail.teamId,
    externalSeasonId: context.seasonId,
    providerTeamName: detail.teamFullname ?? detail.teamName,
    providerLeagueId: detail.teamLeagueId,
    providerLeagueName: detail.teamLeagueName,
    providerOrganisationId: detail.teamOrganisationId,
    providerIsActive: detail.isTeamActive,
    lastSyncedAt: context.syncedAt,
  };
}

// ── Change detection ───────────────────────────────────────────────────────────

type ExistingMapping = {
  providerTeamName: string | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerOrganisationId: number | null;
  providerIsActive: boolean;
};

/**
 * Returns true when the SFV provider data has changed compared to the
 * existing mapping — indicating the mapping needs an update.
 *
 * Only compares provider-owned fields. Does not inspect Team fields.
 */
export function hasProviderChanges(
  existing: ExistingMapping,
  incoming: ReturnType<typeof buildMappingFields>,
): boolean {
  return (
    existing.providerTeamName !== incoming.providerTeamName ||
    existing.providerLeagueId !== incoming.providerLeagueId ||
    existing.providerLeagueName !== incoming.providerLeagueName ||
    existing.providerOrganisationId !== incoming.providerOrganisationId ||
    existing.providerIsActive !== incoming.providerIsActive
  );
}
