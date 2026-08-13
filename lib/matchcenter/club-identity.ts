/**
 * Club Identity Resolution — MATCHCENTER-UX-03-C1
 *
 * Canonical resolution of the effective logo URL for a match side.
 *
 * Rule:
 *   internal team (isOwnTeam) → tenant/club logo (Tenant.logoUrl)
 *   external opponent          → ExternalTeam/ExternalClub logo (externalLogoUrl)
 *   any → null when the relevant source has no logo set
 *
 * This ensures every internal team inherits the visual identity of its own
 * tenant/club — without hardcoding any specific tenant or image path.
 *
 * Priority:
 *   Internal team:
 *     1. tenantLogoUrl  (Tenant.logoUrl — canonical own-club crest)
 *     2. null           (tenant genuinely has no logo configured)
 *   External opponent:
 *     1. externalLogoUrl  (ExternalTeam override → ExternalClub fallback)
 *     2. null             (no Club Directory logo discovered yet)
 *
 * Intentionally small — no framework, no generics, no over-engineering.
 * Reusable across MatchCenter, TrainingCenter, TournamentCenter,
 * Wochenplaner, and any future Centers-family consumer.
 */

import type { MatchcenterSide } from "./types";

/**
 * Resolves the effective logo URL for one match side.
 *
 * @param side          - The MatchcenterSide (home or away).
 * @param tenantLogoUrl - The current tenant's canonical club logo
 *                        (Tenant.logoUrl, may be null if unset).
 * @returns             - The URL string to render, or null for fallback.
 */
export function resolveClubIdentityLogoUrl(
  side: Pick<MatchcenterSide, "isOwnTeam" | "externalLogoUrl">,
  tenantLogoUrl: string | null | undefined,
): string | null {
  if (side.isOwnTeam) {
    return tenantLogoUrl ?? null;
  }
  return side.externalLogoUrl ?? null;
}
