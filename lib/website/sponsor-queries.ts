import { prisma } from "@/lib/db/prisma";

export type SponsorListItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: string | null;
  isActive: boolean;
  showOnWebsite: boolean;
  showOnInfoboard: boolean;
  showOnSponsorStrip: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SponsorDetailData = SponsorListItem;

export async function getSponsorListData(siteId: string): Promise<SponsorListItem[]> {
  return prisma.sponsor.findMany({
    where: { siteId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      logoUrl: true,
      websiteUrl: true,
      tier: true,
      isActive: true,
      showOnWebsite: true,
      showOnInfoboard: true,
      showOnSponsorStrip: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as Promise<SponsorListItem[]>;
}

export async function getSponsorDetailData(
  sponsorId: string,
  siteId: string
): Promise<SponsorDetailData | null> {
  const row = await prisma.sponsor.findFirst({
    where: { id: sponsorId, siteId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      websiteUrl: true,
      tier: true,
      isActive: true,
      showOnWebsite: true,
      showOnInfoboard: true,
      showOnSponsorStrip: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return row as SponsorDetailData | null;
}
