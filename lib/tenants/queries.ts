import { TenantStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const DEFAULT_TENANT_SLUG = "fc-allschwil";

const tenantSelect = {
  id: true,
  slug: true,
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

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    select: tenantSelect,
  });
}

export async function getActiveTenantBySlug(slug: string) {
  return prisma.tenant.findFirst({
    where: {
      slug,
      status: TenantStatus.ACTIVE,
    },
    select: tenantSelect,
  });
}

export async function getDefaultTenant() {
  return getActiveTenantBySlug(DEFAULT_TENANT_SLUG);
}

export type TenantListItem = Awaited<ReturnType<typeof getTenants>>[number];
export type TenantDetail = Awaited<ReturnType<typeof getTenantBySlug>>;
