/**
 * PERSONS-02: Single PersonAssignment management.
 *
 * PATCH  /api/people/[id]/assignments/[assignmentId]  — update assignment
 * DELETE /api/people/[id]/assignments/[assignmentId]  — remove assignment
 *
 * Uses dedicated PersonAssignment model — zero auth side-effects by construction.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import { PersonAssignmentStatus } from "@prisma/client";
import { isPersonFunctionKey } from "@/lib/people/functions";

type RouteContext = { params: Promise<{ id: string; assignmentId: string }> };

async function resolveAssignment(
  personId: string,
  assignmentId: string,
  tenantId: string,
) {
  const assignment = await prisma.personAssignment.findFirst({
    where: { id: assignmentId, personId, tenantId },
    select: {
      id: true,
      personId: true,
      orgUnitId: true,
      teamId: true,
      seasonId: true,
      functionKey: true,
      status: true,
      notes: true,
      tenantId: true,
    },
  });
  return assignment ?? null;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id: personId, assignmentId } = await params;
  const assignment = await resolveAssignment(personId, assignmentId, tenantResult.tenantId);
  if (!assignment) {
    return NextResponse.json({ error: "Zuordnung nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const functionKey = String(body.functionKey ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;
  const statusRaw = String(body.status ?? "").trim();

  if (functionKey && !isPersonFunctionKey(functionKey)) {
    return NextResponse.json({ error: "Ungültige Funktion." }, { status: 400 });
  }

  const validStatuses = Object.values(PersonAssignmentStatus) as string[];
  const status = validStatuses.includes(statusRaw)
    ? (statusRaw as PersonAssignmentStatus)
    : assignment.status;

  const updated = await prisma.personAssignment.update({
    where: { id: assignmentId },
    data: {
      ...(functionKey ? { functionKey } : {}),
      ...(body.notes !== undefined ? { notes } : {}),
      status,
    },
    select: {
      id: true,
      orgUnitId: true,
      teamId: true,
      seasonId: true,
      functionKey: true,
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
    entityId: assignmentId,
    action: "assignment_updated",
    beforeJson: { functionKey: assignment.functionKey, status: assignment.status },
    afterJson: { functionKey, status },
  });

  return NextResponse.json({ assignment: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id: personId, assignmentId } = await params;
  const assignment = await resolveAssignment(personId, assignmentId, tenantResult.tenantId);
  if (!assignment) {
    return NextResponse.json({ error: "Zuordnung nicht gefunden." }, { status: 404 });
  }

  await prisma.personAssignment.delete({ where: { id: assignmentId } });

  await logAction({
    actorUserId: access.session?.user?.id,
    moduleKey: "persons",
    entityType: "PersonAssignment",
    entityId: assignmentId,
    action: "assignment_deleted",
    beforeJson: {
      personId,
      orgUnitId: assignment.orgUnitId,
      teamId: assignment.teamId,
      functionKey: assignment.functionKey,
    },
  });

  return NextResponse.json({ message: "Zuordnung wurde entfernt." });
}
