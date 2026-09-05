import type { Prisma, PrismaClient } from "@prisma/client";

export const PLATFORM_SUPERADMIN_ROLE_KEY = "super_admin";

// PostgreSQL transaction-scoped advisory lock shared by every mutation that
// can change whether a usable platform Superadmin exists.
const PLATFORM_SUPERADMIN_LOCK_ID = 1_397_816_321;

type LockClient = Pick<Prisma.TransactionClient, "$queryRawUnsafe">;
type PlatformAuthorityClient = Pick<PrismaClient, "userRole">;

export const platformSuperAdminAssignmentWhere = {
  tenantId: null,
  role: {
    key: PLATFORM_SUPERADMIN_ROLE_KEY,
    scope: "PLATFORM",
    tenantId: null,
    isArchived: false,
  },
} satisfies Prisma.UserRoleWhereInput;

export const usablePlatformSuperAdminWhere = {
  ...platformSuperAdminAssignmentWhere,
  user: { isActive: true },
} satisfies Prisma.UserRoleWhereInput;

export async function acquirePlatformSuperAdminMutationLock(
  tx: LockClient,
): Promise<void> {
  // Fixed SQL and a fixed integer only; no user-controlled input is interpolated.
  await tx.$queryRawUnsafe(
    "SELECT pg_advisory_xact_lock($1)",
    PLATFORM_SUPERADMIN_LOCK_ID,
  );
}

export async function isPlatformSuperAdmin(
  prisma: PlatformAuthorityClient,
  userId: string,
): Promise<boolean> {
  const assignment = await prisma.userRole.findFirst({
    where: {
      ...platformSuperAdminAssignmentWhere,
      userId,
    },
    select: { id: true },
  });
  return assignment !== null;
}
