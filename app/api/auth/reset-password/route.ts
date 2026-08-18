/**
 * POST /api/auth/reset-password
 *
 * USER-ADMIN-01 — Password reset consumption endpoint.
 *
 * Validates the reset token and updates the user's password.
 * On success, sets passwordChangedAt so existing JWT sessions can be
 * detected as stale by future middleware/auth checks.
 *
 * Password policy: minimum 12 characters.
 *
 * SESSION INVALIDATION NOTE:
 *   passwordChangedAt is stored but existing JWT sessions are NOT actively
 *   invalidated on password reset in this slice. JWTs remain valid until
 *   natural expiry. Robust stale-session enforcement (checking
 *   passwordChangedAt against the JWT iat/session timestamp on every
 *   request) is tracked as a follow-up USER-ADMIN security slice.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { consumePasswordResetToken, validatePasswordResetToken } from "@/lib/auth/password-reset";

const MIN_PASSWORD_LENGTH = 12;

export async function POST(req: NextRequest) {
  let token: string;
  let newPassword: string;
  let confirmPassword: string;

  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
    newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json(
      { error: "Ungültiger oder abgelaufener Link. Bitte fordere einen neuen an." },
      { status: 400 },
    );
  }

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.` },
      { status: 400 },
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Die Passwörter stimmen nicht überein." },
      { status: 400 },
    );
  }

  let success = false;
  try {
    success = await consumePasswordResetToken(prisma, token, newPassword);
  } catch (err) {
    console.error(
      "[reset-password] consumePasswordResetToken error",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 },
    );
  }

  if (!success) {
    return NextResponse.json(
      { error: "Ungültiger oder abgelaufener Link. Bitte fordere einen neuen an." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * GET /api/auth/reset-password?token=...
 *
 * Pre-validates a token before the user sees the reset form — allows
 * the page to show an "invalid/expired" message immediately instead of
 * after the user fills in their new password.
 *
 * For invitation tokens, also returns contextual metadata so the client
 * can render invitation-specific UI (club name, existing-user guidance, etc.).
 *
 * Response schema:
 *   { valid: false }                    — invalid/expired/used token
 *   { valid: true, isInvitation: false } — standard password reset
 *   { valid: true, isInvitation: true, isExistingUser: boolean,
 *     tenantName: string | null, recipientFirstName: string | null }
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  try {
    const validated = await validatePasswordResetToken(prisma, token);
    if (!validated) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    if (!validated.isInvitation) {
      return NextResponse.json({ valid: true, isInvitation: false }, { status: 200 });
    }

    // For invitation tokens, fetch tenant name (best-effort: use the single
    // TenantMembership for newly created users, or null for multi-tenant users).
    let tenantName: string | null = null;
    let recipientFirstName: string | null = null;

    try {
      const user = await prisma.user.findUnique({
        where: { id: validated.userId },
        select: {
          firstName: true,
          tenantMemberships: {
            orderBy: { joinedAt: "desc" },
            take: 1,
            select: {
              tenant: { select: { name: true } },
            },
          },
        },
      });
      if (user) {
        recipientFirstName = user.firstName;
        tenantName = user.tenantMemberships[0]?.tenant.name ?? null;
      }
    } catch {
      // Non-fatal — invitation page will fall back to generic text.
    }

    return NextResponse.json(
      {
        valid: true,
        isInvitation: true,
        isExistingUser: validated.isExistingUser,
        tenantName,
        recipientFirstName,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[reset-password:validate]",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}
