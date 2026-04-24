import { NextResponse } from "next/server";
import { BusinessClubSponsorTier } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.displayName || typeof body.displayName !== "string") {
    return NextResponse.json({ error: "Sponsorname fehlt." }, { status: 400 });
  }

  const tier = Object.values(BusinessClubSponsorTier).includes(body.tier)
    ? body.tier
    : BusinessClubSponsorTier.PARTNER;

  const sponsor = await prisma.businessClubSponsor.create({
    data: {
      displayName: body.displayName.trim(),
      companyName: typeof body.companyName === "string" ? body.companyName.trim() || null : null,
      tier,
      active: true,
      infoboardVisible: Boolean(body.infoboardVisible),
      infoboardWeight: Number.isFinite(Number(body.infoboardWeight))
        ? Math.min(5, Math.max(1, Number(body.infoboardWeight)))
        : 1,
    },
  });

  return NextResponse.json({ sponsor });
}
