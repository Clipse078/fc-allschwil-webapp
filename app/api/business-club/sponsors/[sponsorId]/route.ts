import { NextResponse } from "next/server";
import { BusinessClubSponsorTier } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{
    sponsorId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { sponsorId } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Keine Daten erhalten." }, { status: 400 });
  }

  const data: {
    displayName?: string;
    companyName?: string | null;
    tier?: BusinessClubSponsorTier;
    active?: boolean;
    infoboardVisible?: boolean;
    infoboardWeight?: number;
    infoboardSortOrder?: number;
    remarks?: string | null;
  } = {};

  if (typeof body.displayName === "string" && body.displayName.trim()) {
    data.displayName = body.displayName.trim();
  }

  if (typeof body.companyName === "string") {
    data.companyName = body.companyName.trim() || null;
  }

  if (Object.values(BusinessClubSponsorTier).includes(body.tier)) {
    data.tier = body.tier;
  }

  if (typeof body.active === "boolean") {
    data.active = body.active;
  }

  if (typeof body.infoboardVisible === "boolean") {
    data.infoboardVisible = body.infoboardVisible;
  }

  if (Number.isFinite(Number(body.infoboardWeight))) {
    data.infoboardWeight = Math.min(5, Math.max(1, Number(body.infoboardWeight)));
  }

  if (Number.isFinite(Number(body.infoboardSortOrder))) {
    data.infoboardSortOrder = Math.max(0, Number(body.infoboardSortOrder));
  }

  if (typeof body.remarks === "string") {
    data.remarks = body.remarks.trim() || null;
  }

  const sponsor = await prisma.businessClubSponsor.update({
    where: { id: sponsorId },
    data,
  });

  return NextResponse.json({ sponsor });
}
