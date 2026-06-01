import { TenantStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const DEFAULT_TENANT_KEY = "fc-allschwil";

const tenantSelect = {
  id: true,
  key: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getTenants() {
  return prisma.tenant.findMany({
    where: {
      status: {
        not: TenantStatus.ARCHIVED,
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
      status: TenantStatus.ACTIVE,
    },
    select: tenantSelect,
  });
}

export async function getDefaultTenant() {
  return getActiveTenantByKey(DEFAULT_TENANT_KEY);
}

export type TenantListItem = Awaited<ReturnType<typeof getTenants>>[number];
export type TenantDetail = Awaited<ReturnType<typeof getTenantByKey>>;
