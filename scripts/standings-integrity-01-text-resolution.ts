import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import {
  buildCanonicalClubNameIndexes,
  resolveCanonicalClubFromProviderTeamName,
} from "@/lib/club-directory/canonical-club-resolution";
import { normalizeClubNameForLookup } from "@/lib/club-directory/club-name-normalization";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.STAGE_DB_URL })),
  });
  const tenant = await prisma.tenant.findUnique({ where: { key: "fc-allschwil" }, select: { id: true } });
  const clubs = await prisma.externalClub.findMany({
    where: { tenantId: tenant!.id, archivedAt: null },
    select: {
      id: true,
      name: true,
      shortName: true,
      alternativeName: true,
      logoUrl: true,
      providerMappings: { select: { providerClubName: true, providerClubId: true } },
    },
  });
  const indexes = buildCanonicalClubNameIndexes(clubs);
  const labels = [
    "FC Basler V.Betriebe",
    "BVB BCO Alemannia",
    "FC Basler V Betriebe",
    "Basler V.Betriebe",
    "V.Betriebe",
  ];
  for (const label of labels) {
    const resolved = resolveCanonicalClubFromProviderTeamName(label, indexes);
    console.log(label, "=>", resolved?.name, resolved?.source, resolved?.id);
    const norm = normalizeClubNameForLookup(label);
    const prefixHits = indexes.prefixVariants
      .filter((v) => norm.startsWith(v.normalized))
      .slice(0, 5)
      .map((v) => ({ club: v.club.name, prefix: v.normalized }));
    console.log("  prefix hits", prefixHits);
  }
  await prisma.$disconnect();
}
void main();
