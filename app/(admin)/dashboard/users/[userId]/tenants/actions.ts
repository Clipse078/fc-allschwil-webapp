"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

// ── Guard ──────────────────────────────────────────────────────────────────────

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(session.user.roleKeys ?? []).includes("super_admin")) redirect("/dashboard");
  return session;
}

function tenantPagePath(userId: string) {
  return `/dashboard/users/${userId}/tenants`;
}

// ── assignUserToTenant ────────────────────────────────────────────────────────

export async function assignUserToTenantAction(formData: FormData) {
  await requireSuperAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const role = String(formData.get("role") ?? "member").trim() || "member";

  if (!userId || !tenantId) redirect(`${tenantPagePath(userId)}?status=assign-missing`);

  const [user, tenant] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
  ]);

  if (!user) redirect(`${tenantPagePath(userId)}?status=assign-user-not-found`);
  if (!tenant) redirect(`${tenantPagePath(userId)}?status=assign-tenant-not-found`);

  const existing = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });

  if (existing) {
    await prisma.userTenant.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { isActive: true, role, updatedAt: new Date() },
    });
  } else {
    // First assignment → auto-set as default if user has none
    const hasDefault = await prisma.userTenant.findFirst({
      where: { userId, isDefault: true },
      select: { id: true },
    });

    await prisma.userTenant.create({
      data: {
        userId,
        tenantId,
        role,
        isActive: true,
        isDefault: !hasDefault,
        updatedAt: new Date(),
      },
    });
  }

  revalidatePath(tenantPagePath(userId));
  revalidatePath(`/dashboard/users/${userId}`);
  redirect(`${tenantPagePath(userId)}?status=assign-success`);
}

// ── removeUserFromTenant ──────────────────────────────────────────────────────

export async function removeUserFromTenantAction(formData: FormData) {
  await requireSuperAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();

  if (!userId || !tenantId) redirect(`${tenantPagePath(userId)}?status=remove-missing`);

  const target = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true, isDefault: true },
  });

  if (!target) redirect(`${tenantPagePath(userId)}?status=remove-not-found`);

  // Safety: do not remove if it's the user's last active assignment
  const totalAssigned = await prisma.userTenant.count({
    where: { userId, isActive: true },
  });

  if (totalAssigned <= 1) {
    redirect(`${tenantPagePath(userId)}?status=remove-last-tenant`);
  }

  // Safety: do not remove the default without reassigning first
  if (target.isDefault) {
    redirect(`${tenantPagePath(userId)}?status=remove-is-default`);
  }

  // Check protected superadmin guard
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });

  const isSuperAdminEmail = user?.email === "superadmin@sportclubevo.com";
  const isFcaTenant = tenant?.slug === "fc-allschwil";

  if (isSuperAdminEmail && isFcaTenant) {
    redirect(`${tenantPagePath(userId)}?status=remove-protected`);
  }

  await prisma.userTenant.update({
    where: { userId_tenantId: { userId, tenantId } },
    data: { isActive: false, isDefault: false, updatedAt: new Date() },
  });

  revalidatePath(tenantPagePath(userId));
  revalidatePath(`/dashboard/users/${userId}`);
  redirect(`${tenantPagePath(userId)}?status=remove-success`);
}

// ── setDefaultTenant ──────────────────────────────────────────────────────────

export async function setDefaultTenantAction(formData: FormData) {
  await requireSuperAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();

  if (!userId || !tenantId) redirect(`${tenantPagePath(userId)}?status=default-missing`);

  const target = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true, isActive: true },
  });

  if (!target) redirect(`${tenantPagePath(userId)}?status=default-not-assigned`);
  if (!target.isActive) redirect(`${tenantPagePath(userId)}?status=default-inactive`);

  const now = new Date();

  // Clear all defaults for this user, then set the new one
  await prisma.$transaction([
    prisma.userTenant.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false, updatedAt: now },
    }),
    prisma.userTenant.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { isDefault: true, updatedAt: now },
    }),
  ]);

  revalidatePath(tenantPagePath(userId));
  redirect(`${tenantPagePath(userId)}?status=default-success`);
}
