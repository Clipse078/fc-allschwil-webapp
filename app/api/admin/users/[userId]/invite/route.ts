/**
 * /api/admin/users/[userId]/invite — invitation management for an existing user.
 *
 * POST  → resend invitation (creates new PasswordResetToken with isInvitation=true)
 *         Permission: users.invite
 *         Body: {} (empty)
 *         Returns: { success: true }
 *
 * DELETE → revoke invitation (deletes active invitation token(s))
 *          Permission: users.invite
 *          Returns: { success: true }
 *
 * Tenant isolation: tenantId resolved exclusively from session.activeTenantId.
 * The target userId must have a TenantMembership in the caller's active tenant.
 *
 * HTTP status:
 *   200  — success
 *   400  — no active invitation to revoke
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context
 *   404  — user not a member of this tenant
 *   500  — unexpected internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  resendTenantInvitation,
  revokeTenantInvitation,
  InvitationDomainError,
  INVITATION_EXPIRY_HOURS,
} from "@/lib/users/mutations";
import { sendMail, MailConfigurationError } from "@/lib/email/mailer";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ userId: string }> };

// ── POST: resend invitation ───────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_INVITE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Tenant-Kontext in der Sitzung." }, { status: 403 });
  }

  const actorUserId = access.session.user?.effectiveUserId ?? access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "Ungültige Benutzer-ID." }, { status: 400 });
  }

  try {
    const rawToken = await resendTenantInvitation(tenantId, userId, actorUserId);

    // Send the invitation email.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    if (user) {
      try {
        await _sendInvitationEmail(tenantId, user.email, user.firstName, rawToken);
      } catch (emailError) {
        if (emailError instanceof MailConfigurationError) {
          console.error("[resend-invite] MailConfigurationError:", emailError.message);
        } else {
          console.error("[resend-invite] Email send error:", emailError);
        }
        // Email failure is non-fatal for resend; token is still valid.
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InvitationDomainError) {
      if (error.code === "USER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Benutzer ist kein Mitglied dieses Clubs." },
          { status: 404 },
        );
      }
    }
    console.error("[resend-invite] Unexpected error:", error);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}

// ── DELETE: revoke invitation ─────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_INVITE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Tenant-Kontext in der Sitzung." }, { status: 403 });
  }

  const actorUserId = access.session.user?.effectiveUserId ?? access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "Ungültige Benutzer-ID." }, { status: 400 });
  }

  try {
    await revokeTenantInvitation(tenantId, userId, actorUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InvitationDomainError) {
      if (error.code === "USER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Benutzer ist kein Mitglied dieses Clubs." },
          { status: 404 },
        );
      }
      if (error.code === "NO_ACTIVE_INVITATION") {
        return NextResponse.json(
          { error: "Keine aktive Einladung vorhanden." },
          { status: 400 },
        );
      }
    }
    console.error("[revoke-invite] Unexpected error:", error);
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
