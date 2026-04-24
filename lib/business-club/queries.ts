import { prisma } from "@/lib/db/prisma";

export async function getInfoboardSponsors() {
  const sponsors = await prisma.businessClubSponsor.findMany({
    where: {
      active: true,
      infoboardVisible: true,
    },
    orderBy: [
      { infoboardSortOrder: "asc" },
      { tier: "asc" },
      { displayName: "asc" },
    ],
    select: {
      id: true,
      displayName: true,
      companyName: true,
      tier: true,
      logoUrl: true,
      infoboardWeight: true,
    },
  });

  return sponsors.flatMap((sponsor) => {
    const weight = Math.max(1, sponsor.infoboardWeight);
    return Array.from({ length: weight }, () => ({
      id: sponsor.id,
      displayName: sponsor.displayName,
      companyName: sponsor.companyName,
      tier: sponsor.tier,
      logoUrl: sponsor.logoUrl,
    }));
  });
}
