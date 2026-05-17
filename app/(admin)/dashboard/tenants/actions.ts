"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isSuperAdmin = (session.user.roleKeys ?? []).includes("super_admin");

  if (!isSuperAdmin) {
    redirect("/dashboard?status=forbidden");
  }

  return session;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createTenantAction(formData: FormData) {
  await requireSuperAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const countryCode = String(formData.get("countryCode") ?? "CH").trim() || "CH";
  const sportType = String(formData.get("sportType") ?? "football").trim() || "football";
  const primaryColor = String(formData.get("primaryColor") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const isActiveRaw = formData.get("isActive");
  const isActive = isActiveRaw === "true" || isActiveRaw === "on" || isActiveRaw === "1";

  if (!name) {
    redirect("/dashboard/tenants?status=create-missing-name");
  }

  const slug = slugRaw || slugify(name);

  if (!slug) {
    redirect("/dashboard/tenants?status=create-invalid-slug");
  }

  const existing = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing) {
    redirect("/dashboard/tenants?status=create-slug-exists");
  }

  await prisma.tenant.create({
    data: {
      name,
      slug,
      countryCode,
      sportType,
      primaryColor,
      logoUrl,
      isActive,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tenants");

  redirect("/dashboard/tenants?status=create-success");
}

export async function updateTenantAction(formData: FormData) {
  await requireSuperAdmin();

  const tenantId = String(formData.get("tenantId") ?? "").trim();

  if (!tenantId) {
    redirect("/dashboard/tenants?status=update-missing-id");
  }

  const existing = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!existing) {
    redirect("/dashboard/tenants?status=update-not-found");
  }

  const name = String(formData.get("name") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const countryCode = String(formData.get("countryCode") ?? "CH").trim() || "CH";
  const sportType = String(formData.get("sportType") ?? "football").trim() || "football";
  const primaryColor = String(formData.get("primaryColor") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const isActiveRaw = formData.get("isActive");
  const isActive = isActiveRaw === "true" || isActiveRaw === "on" || isActiveRaw === "1";

  if (!name) {
    redirect(`/dashboard/tenants/${tenantId}?status=update-missing-name`);
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name,
      displayName,
      countryCode,
      sportType,
      primaryColor,
      logoUrl,
      isActive,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${tenantId}`);

  redirect(`/dashboard/tenants/${tenantId}?status=update-success`);
}
