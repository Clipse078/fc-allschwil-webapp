/**
 * PERSON-UX-10: Emergency contact management API.
 *
 * GET  /api/people/[id]/emergency-contacts — list emergency contacts for person
 * POST /api/people/[id]/emergency-contacts — create a new emergency contact
 *
 * Emergency contacts are private operational data.
 * They MUST NOT appear in public serializers.
 *
 * Authorization:
 *   VIEW:   requireApiAnyPermission([PEOPLE_CONTACT_VIEW, PEOPLE_CONTACT_MANAGE])
 *   CREATE: requireApiPermission(PEOPLE_CONTACT_MANAGE)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import {
  listEmergencyContacts,
  createEmergencyContact,
} from "@/lib/people/emergency-contact-service";
import { resolveTenantPerson } from "@/lib/people/guardian-service";

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

  const contacts = await listEmergencyContacts(id, tenantResult.tenantId);
  return NextResponse.json({ contacts });
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

  const { id: personId } = await params;
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

  const firstName = String(body.firstName ?? "").trim();
  if (!firstName) {
    return NextResponse.json(
      { error: "Vorname ist erforderlich." },
      { status: 400 },
    );
  }

  const lastName = String(body.lastName ?? "").trim();
  if (!lastName) {
    return NextResponse.json(
      { error: "Nachname ist erforderlich." },
      { status: 400 },
    );
  }

  const phone = String(body.phone ?? "").trim();
  if (!phone) {
    return NextResponse.json(
      { error: "Telefonnummer ist erforderlich." },
      { status: 400 },
    );
  }

  const relationship = String(body.relationship ?? "").trim() || null;
  const email = String(body.email ?? "").trim() || null;
  const priority = typeof body.priority === "number" ? body.priority : 0;
  const notes = String(body.notes ?? "").trim() || null;

  const result = await createEmergencyContact({
    tenantId,
    personId,
    firstName,
    lastName,
    relationship,
    phone,
    email,
    priority,
    notes,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAction({
    actorUserId: access.session?.user?.id,
    moduleKey: "persons",
    entityType: "PersonEmergencyContact",
    entityId: result.contact.id,
    action: "EMERGENCY_CONTACT_CREATED",
    afterJson: {
      personId,
      priority,
    },
  });

  return NextResponse.json({ contact: result.contact }, { status: 201 });
}
