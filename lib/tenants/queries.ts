import { prisma } from "@/lib/db/prisma";

export async function getTenantsListData() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      displayName: true,
      countryCode: true,
      sportType: true,
      primaryColor: true,
      logoUrl: true,
      isActive: true,
      createdAt: true,
    },
  });

  return tenants;
}

export async function getTenantDetailData(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      displayName: true,
      countryCode: true,
      sportType: true,
      primaryColor: true,
      logoUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getTenantsCount() {
  return prisma.tenant.count();
}

export type TenantOption = {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
  primaryColor: string | null;
};

export async function getAvailableTenantsForUser(
  userId: string,
  roleKeys: string[],
): Promise<TenantOption[]> {
  const isSuperAdmin = roleKeys.includes("super_admin");

  if (isSuperAdmin) {
    return prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, displayName: true, primaryColor: true },
      orderBy: { name: "asc" },
    });
  }

  const userTenants = await prisma.userTenant.findMany({
    where: { userId, isActive: true },
    include: {
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          displayName: true,
          primaryColor: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return userTenants
    .filter((ut) => ut.tenant.isActive)
    .map((ut) => ({
      id: ut.tenant.id,
      slug: ut.tenant.slug,
      name: ut.tenant.name,
      displayName: ut.tenant.displayName,
      primaryColor: ut.tenant.primaryColor,
    }));
}

export async function canUserSwitchToTenant(
  userId: string,
  tenantId: string,
  roleKeys: string[],
): Promise<boolean> {
  const isSuperAdmin = roleKeys.includes("super_admin");

  if (isSuperAdmin) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId, isActive: true },
      select: { id: true },
    });
    return tenant !== null;
  }

  const userTenant = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true, isActive: true },
  });

  return userTenant?.isActive === true;
}

export async function getTenantById(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId, isActive: true },
    select: { id: true, slug: true, name: true, displayName: true },
  });
}
