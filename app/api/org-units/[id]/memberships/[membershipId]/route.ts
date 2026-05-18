import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = { params: Promise<{ id: string; membershipId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id, membershipId } = await params;
  const existing = await prisma.orgUnitMembership.findUnique({
    where: { id: membershipId, orgUnitId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Mitgliedschaft nicht gefunden." }, { status: 404 });

  await prisma.orgUnitMembership.delete({ where: { id: membershipId } });
  return NextResponse.json({ message: "Mitgliedschaft entfernt." });
}
