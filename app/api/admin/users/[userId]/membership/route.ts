/**
 * PATCH /api/admin/users/[userId]/membership
 *
 * Toggles the `isActive` flag of the target user's TenantMembership within
 * the caller's active tenant.
 *
 * Authorization: requires users.manage (platform) OR users.manage_memberships (tenant).
 * Club Admins hold users.manage_memberships; platform Super Admins hold users.manage.
 * Tenant isolation: tenantId resolved exclusively from session.activeTenantId.
 *
 * Request body: { isActive: boolean }
 *
 * Safety invariants delegated to setTenantMembershipActive():
 *   - Self-lockout: actor cannot deactivate their own membership.
 *   - Last Club Admin: cannot deactivate the tenant's last effective Club Admin.
 *   - Scoped update: only TenantMembership.isActive is modified.
 *
 * ---
 *
 * DELETE /api/admin/users/[userId]/membership
 *
 * Permanently removes the target user's TenantMembership and all their
 * scoped UserRole rows for the caller's active tenant.
 *
 * Authorization: requires users.manage (platform) OR users.manage_memberships (tenant).
 *
 * Safety invariants delegated to removeTenantMembership():
 *   - Self-removal: actor cannot remove their own membership.
 *   - Last Club Admin: cannot remove the tenant's last effective Club Admin.
 *   - Scoped removal: only THIS tenant's membership + roles are removed.
 *   - Global User is NEVER deleted. Other tenant memberships are unaffected.
 *   - Person records (linked via Person.userId) are NOT deleted.
 *
 * HTTP status:
 *   200  — { success: true }
 *   400  — invalid request body / domain error
 *   401  — unauthenticated
 *   403  — insufficient permission or missing tenant context
 *   404  — user is not a member of the active tenant
 *   500  — unexpected internal error
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAnyApiPermission } from "@/lib/permissions/require-any-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  setTenantMembershipActive,
  MembershipDomainError,
  removeTenantMembership,
  RemoveMembershipDomainError,
} from "@/lib/users/mutations";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireAnyApiPermission([
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Tenant-Kontext in der Sitzung vorhanden." },
      { status: 403 },
    );
  }

  const { userId } = await context.params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "Ungültige Benutzer-ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfrage-Inhalt." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).isActive !== "boolean"
  ) {
    return NextResponse.json(
      { error: "isActive (boolean) ist erforderlich." },
      { status: 400 },
    );
  }

  const isActive = (body as { isActive: boolean }).isActive;

  const actorUserId =
    access.session.user.effectiveUserId ?? access.session.user.id ?? null;

  try {
    await setTenantMembershipActive(tenantId, userId, isActive, actorUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MembershipDomainError) {
      if (error.code === "MEMBERSHIP_NOT_FOUND") {
        return NextResponse.json(
          { error: "Benutzer ist kein Mitglied dieses Clubs." },
          { status: 404 },
        );
      }
      if (error.code === "SELF_DEACTIVATION") {
        return NextResponse.json(
          { error: "Du kannst deinen eigenen Club-Zugriff nicht sperren." },
          { status: 400 },
        );
      }
      if (error.code === "LAST_CLUB_ADMIN") {
        return NextResponse.json(
          {
            error:
              "Der letzte Club Admin kann nicht gesperrt werden. Weise zuerst einem anderen Benutzer die Club-Admin-Rolle zu.",
          },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const access = await requireAnyApiPermission([
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Tenant-Kontext in der Sitzung vorhanden." },
      { status: 403 },
    );
  }

  const { userId } = await context.params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "Ungültige Benutzer-ID." }, { status: 400 });
  }

  const actorUserId =
    access.session.user.effectiveUserId ?? access.session.user.id ?? null;

  try {
    await removeTenantMembership(tenantId, userId, actorUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RemoveMembershipDomainError) {
      if (error.code === "MEMBERSHIP_NOT_FOUND") {
        return NextResponse.json(
          { error: "Benutzer ist kein Mitglied dieses Clubs." },
          { status: 404 },
        );
      }
      if (error.code === "SELF_REMOVAL") {
        return NextResponse.json(
          { error: "Du kannst deinen eigenen Club-Zugriff nicht entfernen." },
          { status: 400 },
        );
      }
      if (error.code === "LAST_CLUB_ADMIN") {
        return NextResponse.json(
          {
            error:
              "Der letzte Club Admin kann nicht entfernt werden. Weise zuerst einem anderen Benutzer die Club-Admin-Rolle zu.",
          },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 },
    );
  }
}
