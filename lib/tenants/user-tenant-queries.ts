import { prisma } from "@/lib/db/prisma";

export type TenantAssignmentRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantIsActive: boolean;
  primaryColor: string | null;
  assigned: boolean;
  userTenantId: string | null;
  role: string | null;
  isDefault: boolean;
  userTenantIsActive: boolean;
};

export async function getUserTenantAssignments(userId: string): Promise<TenantAssignmentRow[]> {
  const [allTenants, userTenants] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        displayName: true,
        isActive: true,
        primaryColor: true,
      },
    }),
    prisma.userTenant.findMany({
      where: { userId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isDefault: true,
        isActive: true,
      },
    }),
  ]);

  const assignedMap = new Map(userTenants.map((ut) => [ut.tenantId, ut]));

  return allTenants.map((tenant) => {
    const ut = assignedMap.get(tenant.id) ?? null;
    return {
      tenantId: tenant.id,
      tenantName: tenant.displayName ?? tenant.name,
      tenantSlug: tenant.slug,
      tenantIsActive: tenant.isActive,
      primaryColor: tenant.primaryColor,
      assigned: ut !== null,
      userTenantId: ut?.id ?? null,
      role: ut?.role ?? null,
      isDefault: ut?.isDefault ?? false,
      userTenantIsActive: ut?.isActive ?? false,
    };
  });
}

export async function getUserForTenantPage(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      _count: {
        select: { userTenants: true },
      },
    },
  });
}

export async function getUserTenantCount(userId: string) {
  return prisma.userTenant.count({ where: { userId } });
}
