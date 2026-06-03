import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitMembershipStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultTenant } from "@/lib/tenants/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  // Tenant guard: verify the parent OrgUnit belongs to the default tenant
  const tenant = await getDefaultTenant();
  const orgUnit = await prisma.orgUnit.findUnique({ where: { id }, select: { id: true, tenantId: true } });
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (orgUnit.tenantId !== null && tenant && orgUnit.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }

  const memberships = await prisma.orgUnitMembership.findMany({
    where: { orgUnitId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      personId: true,
      roleKey: true,
      status: true,
      isPrimary: true,
      startsAt: true,
      endsAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
  return NextResponse.json({ memberships });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const tenant = await getDefaultTenant();
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const orgUnit = await prisma.orgUnit.findUnique({ where: { id }, select: { id: true, tenantId: true } });
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (orgUnit.tenantId !== null && orgUnit.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = body?.userId?.trim() || null;
  const personId = body?.personId?.trim() || null;
  if (!userId && !personId) return NextResponse.json({ error: "userId oder personId ist erforderlich." }, { status: 400 });

  const validStatuses = Object.values(OrgUnitMembershipStatus);
  const status: OrgUnitMembershipStatus = validStatuses.includes(body?.status) ? body.status : OrgUnitMembershipStatus.ACTIVE;

  try {
    const membership = await prisma.orgUnitMembership.create({
      data: {
        tenantId: orgUnit.tenantId ?? tenant.id,
        orgUnitId: id,
        userId,
        personId,
        roleKey: body?.roleKey?.trim() || null,
        status,
        isPrimary: body?.isPrimary === true,
        startsAt: body?.startsAt ? new Date(body.startsAt) : null,
        endsAt: body?.endsAt ? new Date(body.endsAt) : null,
      },
      select: { id: true, userId: true, personId: true, roleKey: true, status: true },
    });
    return NextResponse.json({ membership }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Mitgliedschaft konnte nicht erstellt werden." }, { status: 500 });
  }
}
