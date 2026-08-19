/**
 * PERSON-UX-10: Guardian relationship management API.
 *
 * GET  /api/people/[id]/guardians — list guardian relationships for person
 * POST /api/people/[id]/guardians — create a new guardian relationship
 *
 * ARCHITECTURAL INVARIANTS (see guardian-service.ts):
 *   Creating a GuardianRelationship does NOT:
 *   - create or modify a User
 *   - create or modify TenantMembership
 *   - grant any Role or RolePermission
 *   - imply mobile/web access for the guardian Person
 *   Guardian relationship and system authorization are separate domains.
 *
 * Authorization:
 *   VIEW: requireApiAnyPermission([PEOPLE_CONTACT_VIEW, PEOPLE_CONTACT_MANAGE])
 *   CREATE: requireApiPermission(PEOPLE_CONTACT_MANAGE)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import {
  resolveTenantPerson,
  listGuardianRelationships,
  createGuardianRelationship,
  isGuardianRelationshipType,
  GUARDIAN_RELATIONSHIP_LABELS,
} from "@/lib/people/guardian-service";
import { GuardianRelationshipType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.PEOPLE_CONTACT_VIEW,
    PERMISSIONS.PEOPLE_CONTACT_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json(
      { error: tenantResult.error },
      { status: tenantResult.status },
    );
  }

  const { id } = await params;
  const person = await resolveTenantPerson(id, tenantResult.tenantId);
  if (!person) {
    return NextResponse.json(
      { error: "Person nicht gefunden." },
      { status: 404 },
    );
  }

  const relationships = await listGuardianRelationships(
    id,
    tenantResult.tenantId,
  );

  return NextResponse.json({ relationships });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_CONTACT_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json(
      { error: tenantResult.error },
      { status: tenantResult.status },
    );
  }
  const { tenantId } = tenantResult;

  const { id: childPersonId } = await params;
  const person = await resolveTenantPerson(childPersonId, tenantId);
  if (!person) {
    return NextResponse.json(
      { error: "Person nicht gefunden." },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const guardianPersonId = String(body.guardianPersonId ?? "").trim();
  if (!guardianPersonId) {
    return NextResponse.json(
      { error: "guardianPersonId ist erforderlich." },
      { status: 400 },
    );
  }

  const relationshipTypeRaw = String(body.relationshipType ?? "").trim();
  const relationshipType: GuardianRelationshipType = isGuardianRelationshipType(
    relationshipTypeRaw,
  )
    ? relationshipTypeRaw
    : GuardianRelationshipType.OTHER;

  const isPrimary =
    body.isPrimary === true || body.isPrimary === "true" ? true : false;
  const notes = String(body.notes ?? "").trim() || null;

  const result = await createGuardianRelationship({
    tenantId,
    childPersonId,
    guardianPersonId,
    relationshipType,
    isPrimary,
    notes,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAction({
    actorUserId: access.session?.user?.id,
    moduleKey: "persons",
    entityType: "GuardianRelationship",
    entityId: result.relationship.id,
    action: "GUARDIAN_RELATIONSHIP_CREATED",
    afterJson: {
      childPersonId,
      guardianPersonId,
      relationshipType,
      relationshipLabel: GUARDIAN_RELATIONSHIP_LABELS[relationshipType],
      isPrimary,
      // Confirm invariant: no authorization side effects
      authSideEffect: "none",
    },
  });

  return NextResponse.json({ relationship: result.relationship }, { status: 201 });
}
