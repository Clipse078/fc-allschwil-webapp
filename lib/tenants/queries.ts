import { prisma } from "@/lib/db/prisma";

export const DEFAULT_TENANT_KEY = "fc-allschwil";

const tenantConfigSelect = {
  countryCode: true,
  sportCategory: true,
  locale: true,
  timezone: true,
  currency: true,
  seasonStartMonth: true,
  seasonTransitionDay: true,
  seasonTransitionMonth: true,
  // Branding v1 — Slice 10.6
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
} as const;

const tenantSelect = {
  id: true,
  key: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const tenantSelectWithConfig = {
  ...tenantSelect,
  ...tenantConfigSelect,
} as const;

export async function getTenants() {
  return prisma.tenant.findMany({
    where: {
      status: {
        not: "ARCHIVED",
      },
    },
    orderBy: [{ name: "asc" }],
    select: tenantSelect,
  });
}

export async function getTenantByKey(key: string) {
  return prisma.tenant.findUnique({
    where: { key },
    select: tenantSelect,
  });
}

export async function getTenantById(id: string) {
  return prisma.tenant.findUnique({
    where: { id },
    select: tenantSelect,
  });
}

/**
 * Slice 11.2b: resolve tenant from session-carried tenantId.
 *
 * When tenantId is present (post-migration users): looks up the tenant by ID
 * directly — no hard-coded key, no DEFAULT_TENANT_KEY dependency.
 *
 * When tenantId is absent (legacy users whose tenantId was not yet backfilled,
 * or bootstrap/seed paths): falls back to getDefaultTenant() so existing
 * behaviour is preserved exactly.
 *
 * Replace all getDefaultTenant() calls in API routes and server components
 * with this function using the session-carried tenantId.
 */
export async function getTenantFromSession(tenantId: string | null | undefined) {
  if (tenantId) return getTenantById(tenantId);
  return getDefaultTenant();
}

export async function getActiveTenantByKey(key: string) {
  return prisma.tenant.findFirst({
    where: {
      key,
      status: "ACTIVE",
    },
    select: tenantSelect,
  });
}

export async function getDefaultTenant() {
  try {
    return await getActiveTenantByKey(DEFAULT_TENANT_KEY);
  } catch {
    return null;
  }
}

export async function getTenantDetail(key: string) {
  return prisma.tenant.findUnique({
    where: { key },
    select: {
      ...tenantSelectWithConfig,
      _count: { select: { registrations: true } },
    },
  });
}

export type TenantConfig = {
  // Nullable: no DB default; must be configured explicitly per tenant.
  countryCode: string | null;
  sportCategory: string | null;
  locale: string | null;
  timezone: string | null;
  currency: string | null;
  // Not nullable: structural scheduling fields with a neutral platform default.
  seasonStartMonth: number;
  seasonTransitionDay: number;
  seasonTransitionMonth: number;
  // Branding v1 — Slice 10.6. All nullable; platform defaults applied via resolveTenantBranding().
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export type TenantListItem = Awaited<ReturnType<typeof getTenants>>[number];
export type TenantDetail = NonNullable<Awaited<ReturnType<typeof getTenantDetail>>>;
export type TenantDetailRaw = Awaited<ReturnType<typeof getTenantByKey>>;
