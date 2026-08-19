/**
 * PERSON-UX-10: Guardian relationship detail API.
 *
 * PATCH  /api/people/[id]/guardians/[relationshipId] — update relationship metadata
 * DELETE /api/people/[id]/guardians/[relationshipId] — remove guardian relationship
 *
 * DELETE removes ONLY the GuardianRelationship record.
 * Neither the child Person nor the guardian Person is deleted.
 * No authorization side effects.
 *
 * Authorization:
 *   PATCH:  requireApiPermission(PEOPLE_CONTACT_MANAGE)
 *   DELETE: requireApiPermission(PEOPLE_CONTACT_MANAGE)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import {
  resolveTenantPerson,
  updateGuardianRelationship,
  deleteGuardianRelationship,
  isGuardianRelationshipType,
  GUARDIAN_RELATIONSHIP_LABELS,
} from "@/lib/people/guardian-service";
import { GuardianRelationshipType } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string; relationshipId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  const { id: childPersonId, relationshipId } = await params;
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

  const relationshipTypeRaw = body.relationshipType !== undefined
    ? String(body.relationshipType).trim()
    : undefined;

  const relationshipType: GuardianRelationshipType | undefined =
    relationshipTypeRaw !== undefined
      ? isGuardianRelationshipType(relationshipTypeRaw)
        ? relationshipTypeRaw
        : GuardianRelationshipType.OTHER
      : undefined;

  const isPrimary =
    body.isPrimary !== undefined
      ? body.isPrimary === true || body.isPrimary === "true"
      : undefined;

  const notes =
    body.notes !== undefined
      ? String(body.notes).trim() || null
      : undefined;

  const result = await updateGuardianRelationship({
    relationshipId,
    childPersonId,
    tenantId,
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
    entityId: relationshipId,
    action: "GUARDIAN_RELATIONSHIP_UPDATED",
    afterJson: {
      childPersonId,
      relationshipType: relationshipType
        ? GUARDIAN_RELATIONSHIP_LABELS[relationshipType]
        : undefined,
      isPrimary,
    },
  });

  return NextResponse.json({ relationship: result.relationship });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
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

  const { id: childPersonId, relationshipId } = await params;
  const person = await resolveTenantPerson(childPersonId, tenantId);
  if (!person) {
    return NextResponse.json(
      { error: "Person nicht gefunden." },
      { status: 404 },
    );
  }

  const result = await deleteGuardianRelationship(
    relationshipId,
    childPersonId,
    tenantId,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAction({
    actorUserId: access.session?.user?.id,
    moduleKey: "persons",
    entityType: "GuardianRelationship",
    entityId: relationshipId,
    action: "GUARDIAN_RELATIONSHIP_REMOVED",
    afterJson: {
      childPersonId,
      // Confirm invariant: relationship deleted only; neither Person deleted
      personSideEffect: "none",
      authSideEffect: "none",
    },
  });

  return new Response(null, { status: 204 });
}
