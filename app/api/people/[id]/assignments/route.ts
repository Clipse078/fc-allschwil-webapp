/**
 * PERSONS-02: Person assignment management API.
 *
 * GET  /api/people/[id]/assignments  — list all assignments for a person
 * POST /api/people/[id]/assignments  — add a new assignment
 *
 * PersonAssignments are stored as OrgUnitMembership rows with personId set.
 * The roleKey field holds the PersonFunction key (e.g. "SPIELER", "TRAINER").
 * These are NOT validated against the Role table — they are organisational
 * function labels, not RPERM authorization roles.
 *
 * CRITICAL: Creating an assignment does NOT grant any RPERM permissions.
 * "Trainer/in" assignment ≠ authorization role.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import { getPersonAssignments } from "@/lib/people/queries";
import { OrgUnitMembershipStatus } from "@prisma/client";
import { isPersonFunctionKey } from "@/lib/people/functions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.PEOPLE_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;

  const person = await prisma.person.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  });
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (tenantResult.ok && person.tenantId && person.tenantId !== tenantResult.tenantId) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const assignments = await getPersonAssignments(id);
  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }
  const { tenantId } = tenantResult;

  const { id: personId } = await params;

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, tenantId: true },
  });
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  // Tenant isolation on person
  if (person.tenantId && person.tenantId !== tenantId) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const orgUnitId = String(body.orgUnitId ?? "").trim();
  const teamId = String(body.teamId ?? "").trim() || null;
  const seasonId = String(body.seasonId ?? "").trim() || null;
  const functionKey = String(body.functionKey ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;

  if (!orgUnitId) {
    return NextResponse.json({ error: "Organisationseinheit ist erforderlich." }, { status: 400 });
  }
  if (!functionKey) {
    return NextResponse.json({ error: "Funktion ist erforderlich." }, { status: 400 });
  }
  if (!isPersonFunctionKey(functionKey)) {
    return NextResponse.json({ error: "Ungültige Funktion." }, { status: 400 });
  }

  // Verify OrgUnit belongs to this tenant
  const orgUnit = await prisma.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: { id: true, tenantId: true, name: true },
  });
  if (!orgUnit || (orgUnit.tenantId && orgUnit.tenantId !== tenantId)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }

  // Verify Team belongs to this tenant (if provided)
  if (teamId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tenantId: true },
    });
    if (!team || (team.tenantId && team.tenantId !== tenantId)) {
      return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
    }
  }

  // Verify Season exists (if provided)
  if (seasonId) {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true },
    });
    if (!season) {
      return NextResponse.json({ error: "Saison nicht gefunden." }, { status: 400 });
    }
  }

  // Duplicate prevention: same person + orgUnit + team + function + season
  const existingDuplicate = await prisma.orgUnitMembership.findFirst({
    where: {
      personId,
      orgUnitId,
      teamId: teamId ?? null,
      roleKey: functionKey,
      seasonId: seasonId ?? null,
      status: OrgUnitMembershipStatus.ACTIVE,
    },
    select: { id: true },
  });
  if (existingDuplicate) {
    return NextResponse.json(
      { error: "Diese Zuordnung existiert bereits für diese Person." },
      { status: 409 },
    );
  }

  try {
    const assignment = await prisma.orgUnitMembership.create({
      data: {
        tenantId,
        orgUnitId,
        personId,
        teamId,
        seasonId,
        roleKey: functionKey,
        status: OrgUnitMembershipStatus.ACTIVE,
        notes,
      },
      select: {
        id: true,
        orgUnitId: true,
        teamId: true,
        seasonId: true,
        roleKey: true,
        status: true,
        orgUnit: { select: { id: true, name: true, key: true } },
        team: { select: { id: true, name: true, shortName: true } },
        season: { select: { id: true, name: true, key: true } },
      },
    });

    await logAction({
      actorUserId: access.session?.user?.id,
      moduleKey: "persons",
      entityType: "PersonAssignment",
      entityId: assignment.id,
      action: "assignment_created",
      afterJson: { personId, orgUnitId, teamId, functionKey, seasonId },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error("Create assignment failed:", error);
    return NextResponse.json({ error: "Zuordnung konnte nicht erstellt werden." }, { status: 500 });
  }
}
