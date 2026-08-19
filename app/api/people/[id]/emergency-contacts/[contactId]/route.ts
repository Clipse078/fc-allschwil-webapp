/**
 * PERSON-UX-10: Emergency contact detail API.
 *
 * PATCH  /api/people/[id]/emergency-contacts/[contactId] — update emergency contact
 * DELETE /api/people/[id]/emergency-contacts/[contactId] — delete emergency contact
 *
 * DELETE removes ONLY the PersonEmergencyContact record.
 * The associated Person is never modified.
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
  updateEmergencyContact,
  deleteEmergencyContact,
} from "@/lib/people/emergency-contact-service";
import { resolveTenantPerson } from "@/lib/people/guardian-service";

type RouteContext = {
  params: Promise<{ id: string; contactId: string }>;
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

  const { id: personId, contactId } = await params;
  const person = await resolveTenantPerson(personId, tenantId);
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

  const patchData: Parameters<typeof updateEmergencyContact>[0] = {
    contactId,
    personId,
    tenantId,
  };

  if (body.firstName !== undefined)
    patchData.firstName = String(body.firstName).trim();
  if (body.lastName !== undefined)
    patchData.lastName = String(body.lastName).trim();
  if (body.relationship !== undefined)
    patchData.relationship = String(body.relationship).trim() || null;
  if (body.phone !== undefined)
    patchData.phone = String(body.phone).trim();
  if (body.email !== undefined)
    patchData.email = String(body.email).trim() || null;
  if (body.priority !== undefined && typeof body.priority === "number")
    patchData.priority = body.priority;
  if (body.notes !== undefined)
    patchData.notes = String(body.notes).trim() || null;

  const result = await updateEmergencyContact(patchData);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAction({
    actorUserId: access.session?.user?.id,
    moduleKey: "persons",
    entityType: "PersonEmergencyContact",
    entityId: contactId,
    action: "EMERGENCY_CONTACT_UPDATED",
    afterJson: { personId },
  });

  return NextResponse.json({ contact: result.contact });
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

  const { id: personId, contactId } = await params;
  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json(
      { error: "Person nicht gefunden." },
      { status: 404 },
    );
  }

  const result = await deleteEmergencyContact(contactId, personId, tenantId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAction({
    actorUserId: access.session?.user?.id,
    moduleKey: "persons",
    entityType: "PersonEmergencyContact",
    entityId: contactId,
    action: "EMERGENCY_CONTACT_DELETED",
    afterJson: { personId, personSideEffect: "none" },
  });

  return new Response(null, { status: 204 });
}
