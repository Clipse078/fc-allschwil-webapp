/**
 * lib/club-directory/provider-sync.ts
 *
 * CLUB-DIRECTORY-01 — pure field-ownership rules for provider (e.g. SFV)
 * sync of ExternalClub / ExternalTeam records.
 *
 * Field ownership (mirrors the discipline already used by
 * TeamExternalMapping / lib/integrations/sfv/sync/team-mapper.ts):
 *   - Tenant-managed: name, shortName, alternativeName, website, location,
 *     notes, categoryLabel, logoUrl (once set). Provider sync NEVER writes
 *     these on an existing record.
 *   - Provider-owned: everything on the *ProviderMapping row (providerClubName,
 *     providerTeamName, providerLogoUrl, providerIsActive, lastSyncedAt, …).
 *     Refreshed on every sync.
 *   - logoUrl is the one field that can be provider-*sourced* — but only to
 *     fill an empty slot (see lib/club-directory/logo.ts mergeProviderLogoUrl).
 *
 * These functions are pure: they compute the update payload but never touch
 * Prisma. The mutation service (lib/club-directory/mutation-service.ts)
 * applies the returned payload.
 */

import { mergeProviderLogoUrl } from "./logo";

export type ProviderClubSyncPayload = {
  providerClubName?: string | null;
  providerLogoUrl?: string | null;
  providerWebsite?: string | null;
  providerIsActive?: boolean;
};

export type ProviderTeamSyncPayload = {
  providerTeamName?: string | null;
  providerClubId?: number | null;
  providerOrganisationId?: number | null;
  providerLogoUrl?: string | null;
  providerIsActive?: boolean;
};

export type ExternalClubMappingUpdate = {
  providerClubName: string | null;
  providerLogoUrl: string | null;
  providerWebsite: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date;
};

export type ExternalTeamMappingUpdate = {
  providerTeamName: string | null;
  providerClubId: number | null;
  providerOrganisationId: number | null;
  providerLogoUrl: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date;
};

export type ExternalClubTenantFieldUpdate = {
  /** Only present when the club had no tenant-managed logo yet. */
  logoUrl?: string;
};

/**
 * Builds the ExternalClubProviderMapping row update from fresh provider
 * data. Always refreshes provider-owned fields and stamps `lastSyncedAt`.
 */
export function buildExternalClubMappingUpdate(
  payload: ProviderClubSyncPayload,
  now: Date,
): ExternalClubMappingUpdate {
  return {
    providerClubName: payload.providerClubName ?? null,
    providerLogoUrl: payload.providerLogoUrl ?? null,
    providerWebsite: payload.providerWebsite ?? null,
    providerIsActive: payload.providerIsActive ?? true,
    lastSyncedAt: now,
  };
}

/**
 * Builds the ExternalTeamProviderMapping row update from fresh provider data.
 */
export function buildExternalTeamMappingUpdate(
  payload: ProviderTeamSyncPayload,
  now: Date,
): ExternalTeamMappingUpdate {
  return {
    providerTeamName: payload.providerTeamName ?? null,
    providerClubId: payload.providerClubId ?? null,
    providerOrganisationId: payload.providerOrganisationId ?? null,
    providerLogoUrl: payload.providerLogoUrl ?? null,
    providerIsActive: payload.providerIsActive ?? true,
    lastSyncedAt: now,
  };
}

/**
 * Computes the (possibly empty) ExternalClub field update triggered by a
 * provider sync. Only ever touches `logoUrl`, and only when the club has no
 * tenant-managed logo yet. Never returns any other ExternalClub field —
 * name / shortName / alternativeName / website / location / notes are
 * exclusively tenant-managed and this function has no way to change them.
 */
export function buildExternalClubTenantFieldUpdate(
  currentLogoUrl: string | null | undefined,
  providerLogoUrl: string | null | undefined,
): ExternalClubTenantFieldUpdate {
  const merged = mergeProviderLogoUrl(currentLogoUrl, providerLogoUrl);
  const current = currentLogoUrl?.trim() || null;

  if (merged !== null && merged !== current) {
    return { logoUrl: merged };
  }
  return {};
}
