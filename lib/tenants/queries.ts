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
};

export type TenantListItem = Awaited<ReturnType<typeof getTenants>>[number];
export type TenantDetail = NonNullable<Awaited<ReturnType<typeof getTenantDetail>>>;
export type TenantDetailRaw = Awaited<ReturnType<typeof getTenantByKey>>;
