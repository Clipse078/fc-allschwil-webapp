/**
 * POST /api/account/change-password — ACCOUNT-01-C2
 *
 * Allows the authenticated user to change their own password by providing
 * their current password for verification.
 *
 * Rules:
 *   - Verifies currentPassword against stored passwordHash (bcryptjs cost 12)
 *   - New password must be ≥ 12 characters (same policy as reset flow)
 *   - newPassword and confirmPassword must match
 *   - Rejects when newPassword === currentPassword (bcrypt compare)
 *   - Updates ONLY User.passwordHash and User.passwordChangedAt
 *   - Does not touch Person, TenantMembership, roles, or other users
 *   - Does not invalidate existing sessions in this slice (same as reset flow)
 *
 * Auth: any authenticated session — users only ever touch their own record.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { logAction } from "@/lib/audit/log-action";

const MIN_PASSWORD_LENGTH = 12;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { currentPassword, newPassword, confirmPassword } = body as Record<string, unknown>;

  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "Aktuelles Passwort ist erforderlich." }, { status: 400 });
  }
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.` },
      { status: 400 },
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Die Passwörter stimmen nicht überein." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const currentValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentValid) {
    return NextResponse.json({ error: "Das aktuelle Passwort ist falsch." }, { status: 400 });
  }

  // Reject reuse of current password
  const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
  if (isSamePassword) {
    return NextResponse.json(
      { error: "Das neue Passwort darf nicht mit dem aktuellen Passwort identisch sein." },
      { status: 400 },
    );
  }

  const newHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, passwordChangedAt: now },
  });

  await logAction({
    action: "account.password_changed",
    entityType: "User",
    entityId: user.id,
    actorUserId: session.user.id,
    moduleKey: "account",
  }).catch(() => {
    // Non-blocking — audit failure must not prevent success response
  });

  return NextResponse.json({ success: true });
}
