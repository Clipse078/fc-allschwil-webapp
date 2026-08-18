/**
 * PERSON-UX-04: Single PersonMembership management.
 *
 * PATCH  /api/people/[id]/memberships/[membershipId]  — update membership fields
 * POST   /api/people/[id]/memberships/[membershipId]/end is handled via action
 *        param: PATCH with { action: "end", endsAt: "..." }
 *
 * No DELETE endpoint: historical records must be preserved permanently.
 *
 * Authorization: requireApiPermission(PEOPLE_MANAGE) for all mutations.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import {
  resolveTenantPerson,
  resolveTenantPersonMembership,
  updatePersonMembership,
  endPersonMembership,
  validateDates,
  isMembershipType,
  isMembershipStatus,
} from "@/lib/people/membership-service";

type RouteContext = { params: Promise<{ id: string; membershipId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }
  const { tenantId } = tenantResult;

  const { id: personId, membershipId } = await params;

  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const membership = await resolveTenantPersonMembership(membershipId, personId, tenantId);
  if (!membership) {
    return NextResponse.json({ error: "Mitgliedschaft nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "").trim();

  // ── End membership action ────────────────────────────────────────────────
  if (action === "end") {
    const endsAtRaw = String(body.endsAt ?? "").trim();
    if (!endsAtRaw) {
      return NextResponse.json({ error: "Austrittsdatum ist erforderlich." }, { status: 400 });
    }
    const endsAt = new Date(endsAtRaw);
    if (isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Austrittsdatum ist ungültig." }, { status: 400 });
    }

    const dateValidation = validateDates(undefined, endsAt, membership.startsAt);
    if (!dateValidation.ok) {
      return NextResponse.json({ error: dateValidation.message }, { status: dateValidation.status });
    }

    const updated = await endPersonMembership(membershipId, endsAt);

    await logAction({
      actorUserId: access.session?.user?.id,
      moduleKey: "persons",
      entityType: "PersonMembership",
      entityId: membershipId,
      action: "membership_ended",
      beforeJson: {
        status: membership.status,
        endsAt: membership.endsAt?.toISOString() ?? null,
      },
      afterJson: {
        status: updated.status,
        endsAt: endsAt.toISOString(),
        // Confirm invariant: no auth side-effect
        authSideEffect: "none",
      },
    });

    return NextResponse.json({ membership: updated });
  }

  // ── Update membership action ─────────────────────────────────────────────
  const membershipTypeRaw = String(body.membershipType ?? "").trim();
  const membershipType = membershipTypeRaw && isMembershipType(membershipTypeRaw)
    ? membershipTypeRaw
    : undefined;

  const statusRaw = String(body.status ?? "").trim();
  const status = statusRaw && isMembershipStatus(statusRaw) ? statusRaw : undefined;

  const memberNumber = body.memberNumber !== undefined
    ? (String(body.memberNumber ?? "").trim() || null)
    : undefined;
  const notes = body.notes !== undefined
    ? (String(body.notes ?? "").trim() || null)
    : undefined;

  let startsAt: Date | undefined;
  const startsAtRaw = String(body.startsAt ?? "").trim();
  if (startsAtRaw) {
    startsAt = new Date(startsAtRaw);
    if (isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "Eintrittsdatum ist ungültig." }, { status: 400 });
    }
  }

  let endsAt: Date | null | undefined;
  if (body.endsAt !== undefined) {
    const endsAtRaw = String(body.endsAt ?? "").trim();
    if (endsAtRaw) {
      endsAt = new Date(endsAtRaw);
      if (isNaN(endsAt.getTime())) {
        return NextResponse.json({ error: "Austrittsdatum ist ungültig." }, { status: 400 });
      }
    } else {
      endsAt = null;
    }
  }

  const dateValidation = validateDates(startsAt, endsAt, membership.startsAt);
  if (!dateValidation.ok) {
    return NextResponse.json({ error: dateValidation.message }, { status: dateValidation.status });
  }

  const updated = await updatePersonMembership(membershipId, {
    membershipType,
    status,
    memberNumber,
    startsAt,
    endsAt,
    notes,
  });

  await logAction({
    actorUserId: access.session?.user?.id,
    moduleKey: "persons",
    entityType: "PersonMembership",
    entityId: membershipId,
    action: "membership_updated",
    beforeJson: {
      membershipType: membership.membershipType,
      status: membership.status,
      memberNumber: membership.memberNumber,
      startsAt: membership.startsAt.toISOString(),
      endsAt: membership.endsAt?.toISOString() ?? null,
    },
    afterJson: {
      membershipType: updated.membershipType,
      status: updated.status,
      memberNumber: updated.memberNumber,
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt?.toISOString() ?? null,
    },
  });

  return NextResponse.json({ membership: updated });
}
