import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitMembershipStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";

// Slice 11.2: tenant is resolved once per request. requireOrgUnitForTenant
// now receives the resolved tenantId explicitly rather than re-fetching it
// internally, making the tenant scope visible at the call site.

type RouteContext = { params: Promise<{ id: string; membershipId: string }> };

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

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id, membershipId } = await params;

  const orgUnit = await requireOrgUnitForTenant(id, tenant.id);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });

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
    seasonId?: string | null;
    notes?: string | null;
  } = {};

  // Slice 11.4: validate roleKey against Role table when provided.
  // roleKey is organisational metadata only — does not affect permissions.
  if ("roleKey" in body) {
    const newRoleKey = typeof body.roleKey === "string" ? body.roleKey.trim() || null : null;
    if (newRoleKey) {
      const roleExists = await prisma.role.findUnique({
        where: { key: newRoleKey },
        select: { id: true },
      });
      if (!roleExists) {
        return NextResponse.json(
          { error: `Rolle „${newRoleKey}" wurde nicht gefunden.` },
          { status: 400 },
        );
      }
    }
    data.roleKey = newRoleKey;
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
  // Phase A: seasonId + notes
  if ("seasonId" in body) {
    const rawSeasonId = typeof body.seasonId === "string" ? body.seasonId.trim() || null : null;
    if (rawSeasonId) {
      const seasonExists = await prisma.season.findUnique({
        where: { id: rawSeasonId },
        select: { id: true },
      });
      if (!seasonExists) {
        return NextResponse.json({ error: "Saison nicht gefunden." }, { status: 400 });
      }
    }
    data.seasonId = rawSeasonId;
  }
  if ("notes" in body) {
    data.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
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
        seasonId: true,
        notes: true,
      },
    });
    return NextResponse.json({ membership: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Mitgliedschaft konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id, membershipId } = await params;

  const orgUnit = await requireOrgUnitForTenant(id, tenant.id);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });

  const existing = await prisma.orgUnitMembership.findUnique({
    where: { id: membershipId, orgUnitId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Mitgliedschaft nicht gefunden." }, { status: 404 });

  await prisma.orgUnitMembership.delete({ where: { id: membershipId } });
  return NextResponse.json({ message: "Mitgliedschaft entfernt." });
}
