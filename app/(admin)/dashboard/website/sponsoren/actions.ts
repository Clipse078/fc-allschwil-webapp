"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";

async function requireWebsite() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const keys = session.user.permissionKeys ?? [];
  if (
    !keys.includes(PERMISSIONS.NEWS_MANAGE) &&
    !keys.includes(PERMISSIONS.WEBSITE_MANAGE)
  ) {
    redirect("/dashboard");
  }
  return session;
}

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string | null) ?? "").trim();
}

function nullable(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v || null;
}

function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "1";
}

function sortInt(fd: FormData, key: string): number {
  const v = parseInt(str(fd, key), 10);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export async function createSponsorAction(formData: FormData) {
  await requireWebsite();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/sponsoren?status=no-site");

  const name = str(formData, "name");
  if (!name) redirect("/dashboard/website/sponsoren/new?status=missing-fields");

  const sponsor = await prisma.sponsor.create({
    data: {
      siteId: site.id,
      name,
      logoUrl: nullable(formData, "logoUrl"),
      websiteUrl: nullable(formData, "websiteUrl"),
      tier: nullable(formData, "tier"),
      isActive: bool(formData, "isActive"),
      showOnWebsite: bool(formData, "showOnWebsite"),
      showOnInfoboard: bool(formData, "showOnInfoboard"),
      showOnSponsorStrip: bool(formData, "showOnSponsorStrip"),
      sortOrder: sortInt(formData, "sortOrder"),
    },
  });

  revalidatePath("/dashboard/website/sponsoren");
  redirect(`/dashboard/website/sponsoren/${sponsor.id}?status=created`);
}

export async function updateSponsorAction(formData: FormData) {
  await requireWebsite();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/sponsoren?status=no-site");

  const sponsorId = str(formData, "sponsorId");
  if (!sponsorId) redirect("/dashboard/website/sponsoren?status=missing-id");

  const existing = await prisma.sponsor.findFirst({
    where: { id: sponsorId, siteId: site.id },
    select: { id: true },
  });
  if (!existing) redirect("/dashboard/website/sponsoren?status=not-found");

  const name = str(formData, "name");
  if (!name)
    redirect(`/dashboard/website/sponsoren/${sponsorId}?status=missing-fields`);

  await prisma.sponsor.update({
    where: { id: sponsorId },
    data: {
      name,
      logoUrl: nullable(formData, "logoUrl"),
      websiteUrl: nullable(formData, "websiteUrl"),
      tier: nullable(formData, "tier"),
      isActive: bool(formData, "isActive"),
      showOnWebsite: bool(formData, "showOnWebsite"),
      showOnInfoboard: bool(formData, "showOnInfoboard"),
      showOnSponsorStrip: bool(formData, "showOnSponsorStrip"),
      sortOrder: sortInt(formData, "sortOrder"),
    },
  });

  revalidatePath("/dashboard/website/sponsoren");
  revalidatePath(`/dashboard/website/sponsoren/${sponsorId}`);
  redirect(`/dashboard/website/sponsoren/${sponsorId}?status=saved`);
}

export async function deleteSponsorAction(formData: FormData) {
  await requireWebsite();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/sponsoren?status=no-site");

  const sponsorId = str(formData, "sponsorId");
  const existing = await prisma.sponsor.findFirst({
    where: { id: sponsorId, siteId: site.id },
    select: { id: true },
  });
  if (!existing) redirect("/dashboard/website/sponsoren?status=not-found");

  await prisma.sponsor.delete({ where: { id: sponsorId } });

  revalidatePath("/dashboard/website/sponsoren");
  redirect("/dashboard/website/sponsoren?status=deleted");
}
