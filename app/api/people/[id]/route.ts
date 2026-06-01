import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

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

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;

  const existing = await prisma.person.findUnique({ where: { id }, select: { id: true } });
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
    if (displayName.length > 150) {
      return NextResponse.json({ error: "Anzeigename darf maximal 150 Zeichen lang sein." }, { status: 400 });
    }
    if (email && (!email.includes("@") || !email.includes("."))) {
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
    }
    if (phone.length > 50) {
      return NextResponse.json({ error: "Telefonnummer darf maximal 50 Zeichen lang sein." }, { status: 400 });
    }
    if (notes.length > 1000) {
      return NextResponse.json({ error: "Notizen dürfen maximal 1000 Zeichen lang sein." }, { status: 400 });
    }

    let dateOfBirth: Date | null = null;
    if (dateOfBirthRaw) {
      const result = validateDateOfBirth(dateOfBirthRaw);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      dateOfBirth = result.date;
    }

    const isActive = body.isActive !== false;
    const isPlayer = body.isPlayer === true;
    const isTrainer = body.isTrainer === true;

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
      },
    });

    return NextResponse.json({ message: "Person aktualisiert.", person });
  } catch (error) {
    console.error("Update person failed:", error);
    return NextResponse.json({ error: "Person konnte nicht aktualisiert werden." }, { status: 500 });
  }
}
