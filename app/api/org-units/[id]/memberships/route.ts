import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitMembershipStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";

// Slice 11.2: tenant is resolved once per request. All OrgUnit access is
// scoped to the resolved tenant. Null tenantId on OrgUnit is treated as
// pre-migration residue and allowed (backwards-compat; documented below).

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Verify the parent OrgUnit belongs to the resolved tenant.
 * Null tenantId = pre-migration residue; treated as default tenant (backwards-compat).
 * Returns the OrgUnit row if accessible; null if not found or cross-tenant.
 */
async function requireOrgUnitForTenant(orgUnitId: string, resolvedTenantId: string) {
  const orgUnit = await prisma.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: { id: true, tenantId: true },
  });
  if (!orgUnit) return null;
  // null tenantId = pre-migration residue; allow access (backwards-compat fallback).
  if (orgUnit.tenantId !== null && orgUnit.tenantId !== resolvedTenantId) return null;
  return orgUnit;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const orgUnit = await requireOrgUnitForTenant(id, tenant.id);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });

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
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const orgUnit = await requireOrgUnitForTenant(id, tenant.id);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const userId = body?.userId?.trim() || null;
  const personId = body?.personId?.trim() || null;
  if (!userId && !personId) return NextResponse.json({ error: "userId oder personId ist erforderlich." }, { status: 400 });

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
        // Use the resolved tenant.id so new memberships are always tenant-scoped.
        // orgUnit.tenantId may be null for pre-migration residue rows; fall back to tenant.id.
        tenantId: orgUnit.tenantId ?? tenant.id,
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
