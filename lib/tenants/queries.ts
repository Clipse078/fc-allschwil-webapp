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
