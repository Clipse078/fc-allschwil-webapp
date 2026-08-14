/**
 * POST /api/invitations — INVITE-01
 *
 * Creates an invitation targeting a Person in the caller's active tenant.
 *
 * Body (existing Person):
 *   { personId: string, email: string }
 *
 * Body (new Person):
 *   { email: string, firstName: string, lastName: string }
 *
 * Permission: users.invite
 * Tenant: from session.user.activeTenantId (never client-supplied)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  createInvitation,
  InvitationAlreadyAcceptedError,
  InvitationPersonNotFoundError,
  PersonAlreadyHasUserError,
} from "@/lib/invitations/service";

export async function POST(request: NextRequest) {
  const guard = await requireTenantRoleApiContext([PERMISSIONS.USERS_INVITE]);
  if (!guard.ok) return guard.response;

  const { tenantId, actorUserId } = guard.context;
  const body = await request.json().catch(() => ({}));

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Gültige E-Mail-Adresse erforderlich." }, { status: 400 });
  }

  const existingPersonId = typeof body.personId === "string" ? body.personId : undefined;
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

  if (!existingPersonId && (!firstName || !lastName)) {
    return NextResponse.json(
      { error: "Entweder Person-ID oder Vor- und Nachname für neue Person erforderlich." },
      { status: 400 },
    );
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? undefined;

  try {
    const result = await createInvitation({
      tenantId,
      actorUserId,
      email,
      existingPersonId,
      newPerson: !existingPersonId ? { firstName, lastName } : undefined,
      appBaseUrl,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof InvitationPersonNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PersonAlreadyHasUserError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof InvitationAlreadyAcceptedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/invitations]", error);
    return NextResponse.json({ error: "Einladung konnte nicht erstellt werden." }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  const guard = await requireTenantRoleApiContext([PERMISSIONS.USERS_INVITE, PERMISSIONS.USERS_VIEW]);
  if (!guard.ok) return guard.response;

  const { tenantId } = guard.context;
  const { getInvitationsForTenant } = await import("@/lib/invitations/service");
  const invitations = await getInvitationsForTenant(tenantId);
  return NextResponse.json({ invitations });
}
