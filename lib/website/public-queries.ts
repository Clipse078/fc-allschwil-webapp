import { prisma } from "@/lib/db/prisma";

export type PublicSiteData = {
  id: string;
  tenantKey: string;
  name: string;
  locale: string;
  primaryColor: string | null;
  logoUrl: string | null;
  footerText: string | null;
  tagline: string | null;
};

export type PublicSponsor = {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: string | null;
  sortOrder: number;
};

export async function getPublicSiteData(
  tenantKey: string
): Promise<PublicSiteData | null> {
  return prisma.websiteSite.findUnique({
    where: { tenantKey, isActive: true },
    select: {
      id: true,
      tenantKey: true,
      name: true,
      locale: true,
      primaryColor: true,
      logoUrl: true,
      footerText: true,
      tagline: true,
    },
  });
}

export async function getPublicSponsors(
  tenantKey: string
): Promise<PublicSponsor[]> {
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey, isActive: true },
    select: { id: true },
  });
  if (!site) return [];

  return prisma.sponsor.findMany({
    where: { siteId: site.id, isActive: true, showOnWebsite: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      logoUrl: true,
      websiteUrl: true,
      tier: true,
      sortOrder: true,
    },
  });
}
