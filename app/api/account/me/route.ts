/**
 * Self-service account API — MEIN-KONTO-01
 *
 * GET  /api/account/me   — current user's profile (User + linked Person)
 * PATCH /api/account/me  — update editable personal fields
 *
 * Auth: any authenticated session (no special permission required — users
 * always own their own account data).
 *
 * Person/User rules (MEIN-KONTO-01-P1):
 *   - If a Person is linked (Person.userId = session.user.id) in the active
 *     tenant: update Person.firstName, Person.lastName, Person.phone and
 *     mirror first/last name onto User for session consistency.
 *   - If no linked Person in this tenant: update User.firstName/lastName only.
 *   - Phone is only stored on Person; omit when no Person is linked.
 *   - login email is always read-only (no verified change flow exists yet).
 *   - Roles, permissions, OrgUnits, teams and tenant access are never touched.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, refreshEffectiveUserSession } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, status: 401 as const, error: "Nicht authentifiziert." };
  }
  return { ok: true as const, session };
}

/**
 * Finds the Person linked to the given userId within the given tenant.
 * Returns null when the user has no Person in this tenant (or no activeTenantId).
 */
async function getLinkedPerson(userId: string, tenantId: string | null) {
  if (!tenantId) return null;
  return prisma.person.findFirst({
    where: { userId, tenantId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      imageUrl: true,
      tenantId: true,
      isActive: true,
    },
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { session } = check;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const linkedPerson = await getLinkedPerson(
    session.user.id,
    session.user.activeTenantId,
  );

  // Resolve the active tenant name for display
  let tenantName: string | null = null;
  if (session.user.activeTenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.activeTenantId },
      select: { name: true },
    });
    tenantName = tenant?.name ?? null;
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    },
    linkedPerson: linkedPerson
      ? {
          id: linkedPerson.id,
          firstName: linkedPerson.firstName,
          lastName: linkedPerson.lastName,
          phone: linkedPerson.phone,
          imageUrl: linkedPerson.imageUrl,
          isActive: linkedPerson.isActive,
        }
      : null,
    activeTenantId: session.user.activeTenantId,
    tenantName,
  });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { session } = check;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;

  if (!firstName) {
    return NextResponse.json({ error: "Vorname ist erforderlich." }, { status: 400 });
  }
  if (firstName.length > 100) {
    return NextResponse.json({ error: "Vorname darf maximal 100 Zeichen lang sein." }, { status: 400 });
  }
  if (!lastName) {
    return NextResponse.json({ error: "Nachname ist erforderlich." }, { status: 400 });
  }
  if (lastName.length > 100) {
    return NextResponse.json({ error: "Nachname darf maximal 100 Zeichen lang sein." }, { status: 400 });
  }
  if (phone !== undefined && phone.length > 50) {
    return NextResponse.json({ error: "Telefonnummer darf maximal 50 Zeichen lang sein." }, { status: 400 });
  }

  const linkedPerson = await getLinkedPerson(
    session.user.id,
    session.user.activeTenantId,
  );

  try {
    if (linkedPerson) {
      // MEIN-KONTO-01-P1: Person is the canonical organisational identity.
      // Update Person fields; mirror name onto User for session consistency.
      await prisma.$transaction([
        prisma.person.update({
          where: { id: linkedPerson.id },
          data: {
            firstName,
            lastName,
            ...(phone !== undefined ? { phone: phone || null } : {}),
          },
        }),
        // Mirror name on User so the JWT stays consistent without a forced
        // re-login. Phone is not a User field.
        prisma.user.update({
          where: { id: session.user.id },
          data: { firstName, lastName },
        }),
      ]);
    } else {
      // No linked Person in this tenant: update User directly.
      // Phone is not stored on User — silently ignored.
      await prisma.user.update({
        where: { id: session.user.id },
        data: { firstName, lastName },
      });
    }

    await logAction({
      actorUserId: session.user.actorUserId ?? session.user.id,
      moduleKey: "account",
      entityType: "User",
      entityId: session.user.id,
      action: "self_updated",
      afterJson: {
        firstName,
        lastName,
        ...(linkedPerson ? { personId: linkedPerson.id } : {}),
      },
    });

    // Refresh from live server state; no browser/session object fields are
    // copied into the JWT.
    await refreshEffectiveUserSession(
      session.user.actorUserId ?? session.user.id,
    );

    return NextResponse.json({
      message: "Profil aktualisiert.",
      firstName,
      lastName,
      ...(linkedPerson && phone !== undefined ? { phone: phone || null } : {}),
    });
  } catch (error) {
    console.error("[account/me] PATCH failed:", error);
    return NextResponse.json({ error: "Profil konnte nicht gespeichert werden." }, { status: 500 });
  }
}
