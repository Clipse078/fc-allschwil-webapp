/**
 * POST /api/admin/users/invite
 *
 * Invite a Person to become a user in the current tenant, OR create a new
 * Person + user in one step.
 *
 * Request body variants:
 *   { personId: string }
 *     — invite an existing Person (must belong to this tenant).
 *   { firstName: string; lastName: string; email: string }
 *     — create a new Person + invite in a single operation.
 *
 * Authorization: requires users.invite (tenant-scoped).
 * Tenant isolation: tenantId resolved exclusively from session.activeTenantId.
 *
 * Identity conflict handling:
 *   - PERSON_NOT_FOUND / PERSON_CROSS_TENANT → 404
 *   - PERSON_ALREADY_LINKED_OTHER_USER → 409
 *   - USER_ALREADY_LINKED_OTHER_PERSON → 409
 *   - EMAIL_TAKEN_BY_OTHER_USER → 409
 *
 * HTTP status:
 *   200  — { success: true, userId: string } (invitation sent)
 *   400  — invalid request body
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context
 *   404  — person not found or cross-tenant
 *   409  — identity conflict
 *   500  — unexpected internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  invitePersonToTenant,
  createPersonAndInvite,
  InvitationDomainError,
} from "@/lib/users/mutations";
import { sendMail, MailConfigurationError } from "@/lib/email/mailer";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";
import { INVITATION_EXPIRY_HOURS } from "@/lib/users/mutations";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_INVITE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Tenant-Kontext in der Sitzung." },
      { status: 403 },
    );
  }

  const actorUserId = access.session.user?.effectiveUserId ?? access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfrage-Inhalt." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Ungültiges Anfrage-Format." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  try {
    let userId: string;
    let recipientEmail: string;
    let recipientFirstName: string;

    if (typeof b.personId === "string" && b.personId.trim()) {
      // Invite existing Person
      const result = await invitePersonToTenant(tenantId, b.personId.trim(), actorUserId);
      userId = result.userId;
      const rawToken = result.rawToken;

      // Get email and name for sending the invitation.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (!user) {
        return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
      }
      recipientEmail = user.email;
      recipientFirstName = user.firstName;

      await _sendInvitationEmail(tenantId, recipientEmail, recipientFirstName, rawToken);
    } else if (
      typeof b.firstName === "string" && b.firstName.trim() &&
      typeof b.lastName === "string" && b.lastName.trim() &&
      typeof b.email === "string" && b.email.trim()
    ) {
      // Create Person + invite
      const result = await createPersonAndInvite(
        tenantId,
        {
          firstName: b.firstName.trim(),
          lastName: b.lastName.trim(),
          email: b.email.trim(),
        },
        actorUserId,
      );
      userId = result.userId;
      recipientEmail = b.email.trim();
      recipientFirstName = b.firstName.trim();

      await _sendInvitationEmail(tenantId, recipientEmail, recipientFirstName, result.rawToken);
    } else {
      return NextResponse.json(
        {
          error:
            "Entweder personId (string) oder firstName + lastName + email (string) sind erforderlich.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    if (error instanceof InvitationDomainError) {
      return _invitationErrorResponse(error);
    }
    if (error instanceof MailConfigurationError) {
      // Email config issue — log server-side; return a friendly error.
      console.error("[invite] MailConfigurationError:", error.message);
      return NextResponse.json(
        { error: "E-Mail-Dienst nicht konfiguriert. Bitte Administrator kontaktieren." },
        { status: 500 },
      );
    }
    console.error("[invite] Unexpected error:", error);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _sendInvitationEmail(
  tenantId: string,
  email: string,
  firstName: string,
  rawToken: string,
) {
  const appBaseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const inviteUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;

  // Get tenant name for the email.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const tenantName = tenant?.name ?? "Ihrem Club";

  const { subject, html, text } = buildInvitationEmail({
    inviteUrl,
    recipientEmail: email,
    recipientFirstName: firstName,
    tenantName,
    expiryHours: INVITATION_EXPIRY_HOURS,
    appBaseUrl: appBaseUrl || undefined,
  });

  await sendMail({ to: email, subject, html, text });
}

function _invitationErrorResponse(error: InvitationDomainError): NextResponse {
  switch (error.code) {
    case "PERSON_NOT_FOUND":
      return NextResponse.json(
        { error: "Person nicht gefunden." },
        { status: 404 },
      );
    case "PERSON_CROSS_TENANT":
      return NextResponse.json(
        { error: "Person gehört nicht zu diesem Club." },
        { status: 404 },
      );
    case "PERSON_ALREADY_LINKED_OTHER_USER":
      return NextResponse.json(
        {
          error:
            "Diese Person ist bereits mit einem anderen Benutzerkonto verknüpft.",
        },
        { status: 409 },
      );
    case "USER_ALREADY_LINKED_OTHER_PERSON":
      return NextResponse.json(
        {
          error:
            "Ein Benutzer mit dieser E-Mail-Adresse ist bereits mit einer anderen Person in diesem Club verknüpft.",
        },
        { status: 409 },
      );
    case "EMAIL_TAKEN_BY_OTHER_USER":
      return NextResponse.json(
        {
          error:
            "Ein Benutzerkonto mit dieser E-Mail-Adresse existiert bereits.",
        },
        { status: 409 },
      );
    case "ALREADY_HAS_ACTIVE_MEMBERSHIP":
      return NextResponse.json(
        { error: "Dieser Benutzer ist bereits aktives Mitglied dieses Clubs." },
        { status: 409 },
      );
    default:
      return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
