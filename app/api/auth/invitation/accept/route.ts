/**
 * POST /api/auth/invitation/accept
 *
 * Consumes an invitation token for a user who already has an active
 * SportClubEvo account (lastLoginAt is set). This path does NOT update the
 * user's password — it only marks the invitation token as used so the
 * link cannot be replayed.
 *
 * This is the "existing global User" acceptance path. The TenantMembership
 * and Person link were already created when the invitation was issued; this
 * endpoint simply closes the invitation lifecycle.
 *
 * HTTP status:
 *   200  — { success: true }
 *   400  — missing/invalid/expired/already-used token, or token belongs to
 *           a new (not-yet-activated) user (must use the password-setup path)
 *   429  — rate limited
 *   500  — unexpected internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validatePasswordResetToken, hashResetToken } from "@/lib/auth/password-reset";
import { activateInvitationMembership } from "@/lib/users/mutations";
import { getClientIp } from "@/lib/security/client-ip";
import {
  AUTH_SECURITY_MESSAGES,
  checkApplicationRateLimit,
} from "@/lib/security/abuse-policy";
import { createRateLimitResponse } from "@/lib/security/rate-limit-response";

function invalidInvitationResponse() {
  return NextResponse.json(
    { error: AUTH_SECURITY_MESSAGES.invalidInvitationLink },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  const rateCheck = checkApplicationRateLimit("invitationAccept", getClientIp(req));
  if (!rateCheck.allowed) {
    return createRateLimitResponse(rateCheck.retryAfterMs);
  }

  let token: string;
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!token) {
    return invalidInvitationResponse();
  }

  const validated = await validatePasswordResetToken(prisma, token).catch(() => null);
  if (!validated || !validated.isInvitation) {
    return invalidInvitationResponse();
  }

  if (!validated.isExistingUser) {
    // New users must go through the password-setup path — same outward error
    // shape as invalid tokens to avoid useful enumeration.
    return invalidInvitationResponse();
  }

  // Mark the token as used (consume without changing the password).
  const tokenHash = hashResetToken(token);
  const now = new Date();
  try {
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null },
        data: { usedAt: now },
      }),
    ]);
  } catch {
    console.error("[invitation/accept] token consumption failed");
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }

  // Activate exactly the membership for the invitation's tenant.
  // Non-fatal — token is already consumed; activation failure can be retried.
  if (validated.invitationTenantId) {
    await activateInvitationMembership(validated.userId, validated.invitationTenantId).catch(
      () => {
        console.error("[invitation/accept] membership activation failed");
      },
    );
  }

  return NextResponse.json({ success: true });
}
