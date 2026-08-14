/**
 * DELETE /api/invitations/[id] — INVITE-01
 *
 * Revokes a PENDING invitation. Never deletes or modifies the Person.
 *
 * Permission: users.invite
 * Tenant: from session.user.activeTenantId (never client-supplied)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  revokeInvitation,
  InvitationNotFoundError,
  InvitationAlreadyAcceptedError,
  InvitationAlreadyRevokedError,
} from "@/lib/invitations/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext([PERMISSIONS.USERS_INVITE]);
  if (!guard.ok) return guard.response;

  const { tenantId, actorUserId } = guard.context;
  const { id } = await params;

  try {
    await revokeInvitation({ invitationId: id, tenantId, actorUserId });
    return NextResponse.json({ revoked: true });
  } catch (error) {
    if (error instanceof InvitationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvitationAlreadyAcceptedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof InvitationAlreadyRevokedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[DELETE /api/invitations/[id]]", error);
    return NextResponse.json({ error: "Einladung konnte nicht widerrufen werden." }, { status: 500 });
  }
}
