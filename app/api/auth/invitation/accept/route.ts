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
import { consumeExistingUserInvitationToken } from "@/lib/auth/password-reset";
import { activateInvitationMembership } from "@/lib/users/mutations";

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

  let consumed: Awaited<
    ReturnType<typeof consumeExistingUserInvitationToken>
  > = null;
  try {
    consumed = await consumeExistingUserInvitationToken(prisma, token);
  } catch (err) {
    console.error("[invitation/accept]", err);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
  if (!consumed) {
    return NextResponse.json(
      { error: "Einladungslink ist ungültig, abgelaufen oder bereits verwendet." },
      { status: 400 },
    );
  }

  // Activate exactly the membership for the invitation's tenant.
  // Non-fatal — token is already consumed; activation failure can be retried.
  if (consumed.invitationTenantId) {
    await activateInvitationMembership(consumed.userId, consumed.invitationTenantId).catch(
      (err) => {
        console.error("[invitation/accept] Failed to activate invitation membership:", err);
      },
    );
  }

  return NextResponse.json({ success: true });
}
