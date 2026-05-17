/**
 * get-default-tenant.ts
 *
 * Phase 1 helper: returns the FC Allschwil tenant as the default platform
 * tenant.  Once multi-tenant routing is implemented (Phase 2), this will be
 * replaced by a session-aware lookup that resolves the tenant from the
 * authenticated user's UserTenant relation or the request URL.
 *
 * Safe to call from any server component or API route.
 * Returns null if the tenant record has not been seeded yet (e.g. fresh DB).
 */

import { prisma } from "@/lib/db/prisma";

export const DEFAULT_TENANT_SLUG = "fc-allschwil";

export type DefaultTenant = {
  id:             string;
  slug:           string;
  name:           string;
  displayName:    string | null;
  countryCode:    string | null;
  sportType:      string | null;
  primaryColor:   string | null;
  secondaryColor: string | null;
  logoUrl:        string | null;
  isActive:       boolean;
};

/**
 * Fetch the default (FC Allschwil) tenant record.
 * Returns null when the tenant has not been seeded — callers must handle this.
 */
export async function getDefaultTenant(): Promise<DefaultTenant | null> {
  return prisma.tenant.findFirst({
    where:  { slug: DEFAULT_TENANT_SLUG, isActive: true },
    select: {
      id:             true,
      slug:           true,
      name:           true,
      displayName:    true,
      countryCode:    true,
      sportType:      true,
      primaryColor:   true,
      secondaryColor: true,
      logoUrl:        true,
      isActive:       true,
    },
  });
}
