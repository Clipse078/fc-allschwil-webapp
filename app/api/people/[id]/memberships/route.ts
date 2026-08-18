/**
 * PERSON-UX-04: Club membership management API.
 *
 * GET  /api/people/[id]/memberships  — list all membership records for a person
 * POST /api/people/[id]/memberships  — create a new PersonMembership
 *
 * PersonMembership is DEDICATED — NOT TenantMembership, OrgUnitMembership,
 * or PersonAssignment. Club membership is independent of every other relation.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * Creating a PersonMembership does NOT:
 * - create or modify TenantMembership
 * - create or modify UserRole
 * - grant RPERM permissions
 * - affect Person.isActive
 * - affect PersonAssignment or any sporting relation
 *
 * Authorization:
 *   VIEW: requireApiAnyPermission([PEOPLE_VIEW, PEOPLE_MANAGE])
 *   CREATE: requireApiPermission(PEOPLE_MANAGE)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import { getPersonMemberships } from "@/lib/people/queries";
import {
  resolveTenantPerson,
  createPersonMembership,
  validateDates,
  isMembershipType,
} from "@/lib/people/membership-service";
import { PersonMembershipType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.PEOPLE_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id } = await params;
  const person = await resolveTenantPerson(id, tenantResult.tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const memberships = await getPersonMemberships(id);
  return NextResponse.json({ memberships });
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
  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const membershipTypeRaw = String(body.membershipType ?? "").trim();
  const membershipType: PersonMembershipType = isMembershipType(membershipTypeRaw)
    ? membershipTypeRaw
    : PersonMembershipType.ACTIVE_MEMBER;

  const memberNumber = String(body.memberNumber ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;

  const startsAtRaw = String(body.startsAt ?? "").trim();
  if (!startsAtRaw) {
    return NextResponse.json({ error: "Eintrittsdatum ist erforderlich." }, { status: 400 });
  }
  const startsAt = new Date(startsAtRaw);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Eintrittsdatum ist ungültig." }, { status: 400 });
  }

  let endsAt: Date | null = null;
  const endsAtRaw = String(body.endsAt ?? "").trim();
  if (endsAtRaw) {
    endsAt = new Date(endsAtRaw);
    if (isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Austrittsdatum ist ungültig." }, { status: 400 });
    }
  }

  const dateValidation = validateDates(startsAt, endsAt);
  if (!dateValidation.ok) {
    return NextResponse.json({ error: dateValidation.message }, { status: dateValidation.status });
  }

  try {
    const membership = await createPersonMembership({
      tenantId,
      personId,
      membershipType,
      memberNumber,
      startsAt,
      endsAt,
      notes,
    });

    await logAction({
      actorUserId: access.session?.user?.id,
      moduleKey: "persons",
      entityType: "PersonMembership",
      entityId: membership.id,
      action: "membership_created",
      afterJson: {
        personId,
        membershipType,
        status: membership.status,
        memberNumber,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt?.toISOString() ?? null,
        // Confirm invariant: no auth side-effect
        authSideEffect: "none",
      },
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    console.error("Create membership failed:", error);
    return NextResponse.json({ error: "Mitgliedschaft konnte nicht erstellt werden." }, { status: 500 });
  }
}
