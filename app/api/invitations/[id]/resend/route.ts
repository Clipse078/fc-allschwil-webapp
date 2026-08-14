/**
 * POST /api/invitations/[id]/resend — INVITE-01
 *
 * Resends a PENDING invitation with a fresh token.
 *
 * Permission: users.invite
 * Tenant: from session.user.activeTenantId (never client-supplied)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  resendInvitation,
  InvitationNotFoundError,
  InvitationAlreadyAcceptedError,
  InvitationAlreadyRevokedError,
} from "@/lib/invitations/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext([PERMISSIONS.USERS_INVITE]);
  if (!guard.ok) return guard.response;

  const { tenantId, actorUserId } = guard.context;
  const { id } = await params;

  const appBaseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? undefined;

  try {
    await resendInvitation({ invitationId: id, tenantId, actorUserId, appBaseUrl });
    return NextResponse.json({ resent: true });
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
    console.error("[POST /api/invitations/[id]/resend]", error);
    return NextResponse.json({ error: "Einladung konnte nicht erneut gesendet werden." }, { status: 500 });
  }
}
