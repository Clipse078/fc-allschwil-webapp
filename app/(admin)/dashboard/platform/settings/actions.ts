"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(session.user.roleKeys ?? []).includes("super_admin")) redirect("/dashboard");
  return session;
}

export async function saveTenantBrandingAction(formData: FormData) {
  await requireSuperAdmin();

  const tenantId = String(formData.get("tenantId") ?? "").trim();
  if (!tenantId) redirect("/dashboard/platform/settings?status=missing-tenant");

  const name = String(formData.get("name") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const shortName = String(formData.get("shortName") ?? "").trim() || null;
  const primaryColor = String(formData.get("primaryColor") ?? "").trim() || null;
  const secondaryColor = String(formData.get("secondaryColor") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const countryCode = String(formData.get("countryCode") ?? "CH").trim() || "CH";
  const sportType = String(formData.get("sportType") ?? "football").trim() || "football";
  const isActiveRaw = formData.get("isActive");
  const isActive = isActiveRaw === "on" || isActiveRaw === "true" || isActiveRaw === "1";

  if (!name) redirect("/dashboard/platform/settings?status=missing-name");

  const existing = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!existing) redirect("/dashboard/platform/settings?status=not-found");

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name,
      displayName,
      shortName,
      primaryColor,
      secondaryColor,
      logoUrl,
      countryCode,
      sportType,
      isActive,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/platform/settings");
  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${tenantId}`);

  redirect(`/dashboard/platform/settings?tenant=${tenantId}&status=saved`);
}
