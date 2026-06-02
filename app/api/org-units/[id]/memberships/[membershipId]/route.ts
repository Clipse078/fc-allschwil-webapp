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

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (typeof body.roleKey === "string") {
    patch.roleKey = body.roleKey.trim() || null;
  }
  if (body.status !== undefined) {
    const validStatuses = Object.values(OrgUnitMembershipStatus);
    if (!validStatuses.includes(body.status as OrgUnitMembershipStatus)) {
      return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.isPrimary === "boolean") {
    patch.isPrimary = body.isPrimary;
  }
  if (body.startsAt !== undefined) {
    patch.startsAt = body.startsAt ? new Date(body.startsAt as string) : null;
  }
  if (body.endsAt !== undefined) {
    patch.endsAt = body.endsAt ? new Date(body.endsAt as string) : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Keine Felder zum Aktualisieren angegeben." }, { status: 400 });
  }

  try {
    const membership = await prisma.orgUnitMembership.update({
      where: { id: membershipId },
      data: patch,
      select: {
        id: true,
        roleKey: true,
        status: true,
        isPrimary: true,
        startsAt: true,
        endsAt: true,
      },
    });
    return NextResponse.json({ membership });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Mitgliedschaft konnte nicht aktualisiert werden." },
      { status: 500 }
    );
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
