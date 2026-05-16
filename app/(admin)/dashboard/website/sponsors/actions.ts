"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

async function requireAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(session.user.permissionKeys ?? []).includes(PERMISSIONS.WEBSITE_MANAGE)) {
    redirect("/dashboard?error=access-denied");
  }
  return session;
}

export async function createSponsorEntry(formData: FormData) {
  await requireAccess();

  const name = String(formData.get("name") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim() || null;
  const tier = String(formData.get("tier") ?? "").trim() || null;

  if (!name) return;

  let site = await prisma.websiteSite.findUnique({ where: { tenantKey: SITE_TENANT_KEY }, select: { id: true } });
  if (!site) {
    site = await prisma.websiteSite.create({ data: { tenantKey: SITE_TENANT_KEY, name: SITE_TENANT_KEY }, select: { id: true } });
  }

  const maxOrder = await prisma.sponsorEntry.aggregate({ where: { siteId: site.id }, _max: { sortOrder: true } });
  const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  await prisma.sponsorEntry.create({ data: { siteId: site.id, name, logoUrl, websiteUrl, tier, sortOrder } });
  revalidatePath("/dashboard/website/sponsors");
}

export async function toggleSponsorActive(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.get("isActive") === "true";
  if (!id) return;

  await prisma.sponsorEntry.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/dashboard/website/sponsors");
}

export async function updateSponsorVisibility(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id") ?? "").trim();
  const field = String(formData.get("field") ?? "").trim();
  const currentVal = formData.get("current") === "true";

  const allowed = ["showOnWebsite", "showOnInfoboard", "showOnSponsorStrip"];
  if (!id || !allowed.includes(field)) return;

  await prisma.sponsorEntry.update({
    where: { id },
    data: { [field]: !currentVal },
  });
  revalidatePath("/dashboard/website/sponsors");
}

export async function moveSponsor(formData: FormData) {
  await requireAccess();

  const id = String(formData.get("id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim() as "up" | "down";
  if (!id || !["up", "down"].includes(direction)) return;

  const site = await prisma.websiteSite.findUnique({ where: { tenantKey: SITE_TENANT_KEY }, select: { id: true } });
  if (!site) return;

  const all = await prisma.sponsorEntry.findMany({
    where: { siteId: site.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const idx = all.findIndex((s) => s.id === id);
  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= all.length) return;

  await prisma.$transaction([
    prisma.sponsorEntry.update({ where: { id: all[idx].id }, data: { sortOrder: all[newIdx].sortOrder } }),
    prisma.sponsorEntry.update({ where: { id: all[newIdx].id }, data: { sortOrder: all[idx].sortOrder } }),
  ]);

  revalidatePath("/dashboard/website/sponsors");
}
