import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitMembershipStatus } from "@prisma/client";
import { requireApiTenantPermissionContext } from "@/lib/permissions/require-api-tenant-context";
import { PERMISSIONS } from "@/lib/permissions/permissions";

// Tenant is resolved once from the authenticated effective actor. All
// OrgUnit and identity access is scoped to that exact tenant.

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Verify the parent OrgUnit belongs to the resolved tenant.
 * Returns the OrgUnit row if accessible; null if not found or cross-tenant.
 */
async function requireOrgUnitForTenant(orgUnitId: string, resolvedTenantId: string) {
  return prisma.orgUnit.findFirst({
    where: { id: orgUnitId, tenantId: resolvedTenantId },
    select: { id: true, tenantId: true },
  });
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiTenantPermissionContext([PERMISSIONS.ORG_MANAGE]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { tenantId } = access.context;

  const { id } = await params;
  const orgUnit = await requireOrgUnitForTenant(id, tenantId);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });

  const memberships = await prisma.orgUnitMembership.findMany({
    where: { orgUnitId: id, tenantId },
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
        where: {
          isActive: true,
          tenantMemberships: { some: { tenantId, isActive: true } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      person: {
        where: { tenantId },
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
  const access = await requireApiTenantPermissionContext([PERMISSIONS.ORG_MANAGE]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { tenantId } = access.context;

  const { id } = await params;
  const orgUnit = await requireOrgUnitForTenant(id, tenantId);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId.trim() || null : null;
  const personId = typeof body?.personId === "string" ? body.personId.trim() || null : null;
  if (!userId && !personId) return NextResponse.json({ error: "userId oder personId ist erforderlich." }, { status: 400 });

  const userMembership = userId
    ? await prisma.tenantMembership.findFirst({
        where: {
          tenantId,
          userId,
          isActive: true,
          user: { isActive: true },
        },
        select: { userId: true },
      })
    : null;
  if (userId && !userMembership) {
    return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
  }

  const person = personId
    ? await prisma.person.findFirst({
        where: { id: personId, tenantId },
        select: { id: true, userId: true },
      })
    : null;
  if (personId && !person) {
    return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
  }
  if (userId && person && person.userId !== userId) {
    return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
  }

  const validStatuses = Object.values(OrgUnitMembershipStatus);
  const status: OrgUnitMembershipStatus = validStatuses.includes(body?.status) ? body.status : OrgUnitMembershipStatus.ACTIVE;

  // Slice 11.4: validate roleKey against Role table when provided.
  // roleKey is organisational metadata only — does not affect permissions.
  const rawRoleKey: string | null = body?.roleKey?.trim() || null;
  if (rawRoleKey) {
    const roleExists = await prisma.role.findUnique({
      where: { key: rawRoleKey },
      select: { id: true },
    });
    if (!roleExists) {
      return NextResponse.json(
        { error: `Rolle „${rawRoleKey}" wurde nicht gefunden.` },
        { status: 400 },
      );
    }
  }

  // Phase A: seasonId — optional reference to a Season for time-bounded memberships.
  const rawSeasonId: string | null = body?.seasonId?.trim() || null;
  if (rawSeasonId) {
    const seasonExists = await prisma.season.findUnique({
      where: { id: rawSeasonId },
      select: { id: true },
    });
    if (!seasonExists) {
      return NextResponse.json({ error: "Saison nicht gefunden." }, { status: 400 });
    }
  }

  // Phase A: notes — optional free-text for contextual information.
  const notes: string | null = body?.notes?.trim() || null;

  try {
    const membership = await prisma.orgUnitMembership.create({
      data: {
        tenantId,
        orgUnitId: id,
        userId,
        personId,
        roleKey: rawRoleKey,
        status,
        isPrimary: body?.isPrimary === true,
        startsAt: body?.startsAt ? new Date(body.startsAt) : null,
        endsAt: body?.endsAt ? new Date(body.endsAt) : null,
        seasonId: rawSeasonId,
        notes,
      },
      select: { id: true, userId: true, personId: true, roleKey: true, status: true, seasonId: true },
    });
    return NextResponse.json({ membership }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Mitgliedschaft konnte nicht erstellt werden." }, { status: 500 });
  }
}
