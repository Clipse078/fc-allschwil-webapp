import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitMembershipStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = { params: Promise<{ id: string; membershipId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id, membershipId } = await params;
  const existing = await prisma.orgUnitMembership.findUnique({
    where: { id: membershipId, orgUnitId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Mitgliedschaft nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const validStatuses = Object.values(OrgUnitMembershipStatus);
  const data: {
    roleKey?: string | null;
    isPrimary?: boolean;
    status?: OrgUnitMembershipStatus;
    startsAt?: Date | null;
    endsAt?: Date | null;
  } = {};

  if ("roleKey" in body) {
    data.roleKey = typeof body.roleKey === "string" ? body.roleKey.trim() || null : null;
  }
  if ("isPrimary" in body) {
    data.isPrimary = body.isPrimary === true;
  }
  if ("status" in body && validStatuses.includes(body.status)) {
    data.status = body.status as OrgUnitMembershipStatus;
  }
  if ("startsAt" in body) {
    data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  }
  if ("endsAt" in body) {
    data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Felder zum Aktualisieren angegeben." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.orgUnitMembership.update({
      where: { id: membershipId },
      data,
      select: {
        id: true,
        roleKey: true,
        isPrimary: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });
    return NextResponse.json({ membership: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Mitgliedschaft konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

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
