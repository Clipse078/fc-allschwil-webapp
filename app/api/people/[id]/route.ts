import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";

type RouteContext = { params: Promise<{ id: string }> };

function validateDateOfBirth(raw: string): { date: Date } | { error: string } {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return { error: "Ungültiges Geburtsdatum." };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dob = new Date(raw);
  dob.setHours(0, 0, 0, 0);
  if (dob > today) {
    return { error: "Geburtsdatum darf nicht in der Zukunft liegen." };
  }
  return { date };
}

/** Resolve a Person by id, enforcing strict tenant isolation. */
async function resolveTenantPerson(id: string, tenantId: string) {
  const person = await prisma.person.findUnique({
    where: { id },
    select: { id: true, tenantId: true, firstName: true, lastName: true, userId: true },
  });
  if (!person) return null;
  if (person.tenantId !== tenantId) return null; // strict — no null fallback
  return person;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.PEOPLE_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id } = await params;
  const check = await resolveTenantPerson(id, tenantResult.tenantId);
  if (!check) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const person = await prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      notes: true,
      imageUrl: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
      isFunctionary: true,
      isVolunteer: true,
      isReferee: true,
      isSponsorContact: true,
      customFunctions: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json({ person });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id } = await params;
  const existing = await resolveTenantPerson(id, tenantResult.tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const displayName = String(body.displayName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const dateOfBirthRaw = String(body.dateOfBirth ?? "").trim();

    if (!firstName) return NextResponse.json({ error: "Vorname ist erforderlich." }, { status: 400 });
    if (firstName.length > 100) return NextResponse.json({ error: "Vorname darf maximal 100 Zeichen lang sein." }, { status: 400 });
    if (!lastName) return NextResponse.json({ error: "Nachname ist erforderlich." }, { status: 400 });
    if (lastName.length > 100) return NextResponse.json({ error: "Nachname darf maximal 100 Zeichen lang sein." }, { status: 400 });
    if (displayName.length > 150) return NextResponse.json({ error: "Anzeigename darf maximal 150 Zeichen lang sein." }, { status: 400 });
    if (email && (!email.includes("@") || !email.includes("."))) return NextResponse.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
    if (phone.length > 50) return NextResponse.json({ error: "Telefonnummer darf maximal 50 Zeichen lang sein." }, { status: 400 });
    if (notes.length > 1000) return NextResponse.json({ error: "Notizen dürfen maximal 1000 Zeichen lang sein." }, { status: 400 });

    let dateOfBirth: Date | null = null;
    if (dateOfBirthRaw) {
      const result = validateDateOfBirth(dateOfBirthRaw);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      dateOfBirth = result.date;
    }

    const isActive = body.isActive !== false;
    const isPlayer = body.isPlayer === true;
    const isTrainer = body.isTrainer === true;
    // PERSON-UX-07: new capacity flags
    const isFunctionary = body.isFunctionary === true;
    const isVolunteer = body.isVolunteer === true;
    const isReferee = body.isReferee === true;
    const isSponsorContact = body.isSponsorContact === true;

    // PERSON-UX-07: custom functions — validate array of strings
    const rawCustomFunctions = body.customFunctions;
    const customFunctions: string[] = Array.isArray(rawCustomFunctions)
      ? rawCustomFunctions
          .map((f) => String(f).trim())
          .filter((f) => f.length > 0 && f.length <= 100)
          .slice(0, 20)
      : [];

    const person = await prisma.person.update({
      where: { id },
      data: {
        firstName,
        lastName,
        displayName: displayName || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        dateOfBirth,
        isActive,
        isPlayer,
        isTrainer,
        isFunctionary,
        isVolunteer,
        isReferee,
        isSponsorContact,
        customFunctions,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        isActive: true,
        isPlayer: true,
        isTrainer: true,
        isFunctionary: true,
        isVolunteer: true,
        isReferee: true,
        isSponsorContact: true,
        customFunctions: true,
      },
    });

    await logAction({
      actorUserId: access.session?.user?.id,
      moduleKey: "persons",
      entityType: "Person",
      entityId: person.id,
      action: "updated",
      beforeJson: { firstName: existing.firstName, lastName: existing.lastName },
      afterJson: { firstName, lastName, email: email || null },
    });

    return NextResponse.json({ message: "Person aktualisiert.", person });
  } catch (error) {
    console.error("Update person failed:", error);
    return NextResponse.json({ error: "Person konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

/**
 * PERSONS-01: Permanent deletion of a tenant Person record.
 *
 * Requires PEOPLE_DELETE (separate from PEOPLE_MANAGE — see ADMIN-DELETE convention).
 *
 * Cascade behavior:
 * - PersonAssignment rows cascade-deleted via FK onDelete: Cascade
 * - PlayerSquadMember / TrainerTeamMember: onDelete: SetNull (historical data preserved)
 * - Linked User: NOT deleted — Person ↔ User are separate lifecycles.
 *   Deleting Person sets Person.userId = null via FK (unique) onDelete behavior
 *   in the schema. The User account, TenantMembership, UserRole, and all auth data
 *   are never touched.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_DELETE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id } = await params;
  const existing = await resolveTenantPerson(id, tenantResult.tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  try {
    // PersonAssignment rows are cascade-deleted by FK (onDelete: Cascade on Person).
    // We still call deleteMany explicitly for audit clarity + to be explicit.
    await prisma.personAssignment.deleteMany({ where: { personId: id } });

    await prisma.person.delete({ where: { id } });

    await logAction({
      actorUserId: access.session?.user?.id,
      moduleKey: "persons",
      entityType: "Person",
      entityId: id,
      action: "deleted",
      beforeJson: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        hadLinkedUser: !!existing.userId,
        // Confirm: no UserRole/TenantMembership/auth data was touched
        authDataPreserved: true,
      },
    });

    return NextResponse.json({ message: "Person wurde dauerhaft gelöscht." });
  } catch (error) {
    console.error("Delete person failed:", error);
    return NextResponse.json({ error: "Person konnte nicht gelöscht werden." }, { status: 500 });
  }
}
