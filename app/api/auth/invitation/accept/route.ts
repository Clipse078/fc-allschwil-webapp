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
 *   500  — unexpected internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validatePasswordResetToken, hashResetToken } from "@/lib/auth/password-reset";
import { activatePendingInvitationMemberships } from "@/lib/users/mutations";

export async function POST(req: NextRequest) {
  let token: string;
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const validated = await validatePasswordResetToken(prisma, token).catch(() => null);
  if (!validated) {
    return NextResponse.json(
      { error: "Einladungslink ist ungültig, abgelaufen oder bereits verwendet." },
      { status: 400 },
    );
  }

  if (!validated.isInvitation) {
    return NextResponse.json(
      { error: "Dieser Link ist kein Einladungslink." },
      { status: 400 },
    );
  }

  if (!validated.isExistingUser) {
    // New users must go through the password-setup path.
    return NextResponse.json(
      { error: "Bitte richte dein Passwort über den Einladungslink ein." },
      { status: 400 },
    );
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
  } catch (err) {
    console.error("[invitation/accept]", err);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }

  // Activate the pending TenantMembership now that the user has accepted.
  // Non-fatal — token is already consumed.
  await activatePendingInvitationMemberships(validated.userId).catch((err) => {
    console.error("[invitation/accept] Failed to activate memberships:", err);
  });

  return NextResponse.json({ success: true });
}
