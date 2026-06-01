import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

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

function validatePersonBody(body: Record<string, unknown>): { error: string } | null {
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const displayName = String(body.displayName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const dateOfBirthRaw = String(body.dateOfBirth ?? "").trim();

  if (!firstName) return { error: "Vorname ist erforderlich." };
  if (firstName.length > 100) return { error: "Vorname darf maximal 100 Zeichen lang sein." };
  if (!lastName) return { error: "Nachname ist erforderlich." };
  if (lastName.length > 100) return { error: "Nachname darf maximal 100 Zeichen lang sein." };
  if (displayName.length > 150) return { error: "Anzeigename darf maximal 150 Zeichen lang sein." };
  if (email && (!email.includes("@") || !email.includes("."))) {
    return { error: "Ungültige E-Mail-Adresse." };
  }
  if (phone.length > 50) return { error: "Telefonnummer darf maximal 50 Zeichen lang sein." };
  if (notes.length > 1000) return { error: "Notizen dürfen maximal 1000 Zeichen lang sein." };
  if (dateOfBirthRaw) {
    const result = validateDateOfBirth(dateOfBirthRaw);
    if ("error" in result) return { error: result.error };
  }
  return null;
}

export async function GET() {
  const access = await requireApiAnyPermission([
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.PEOPLE_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const persons = await prisma.person.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
    },
  });

  return NextResponse.json({ persons });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const validationError = validatePersonBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError.error }, { status: 400 });
    }

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const displayName = String(body.displayName ?? "").trim() || null;
    const email = String(body.email ?? "").trim() || null;
    const phone = String(body.phone ?? "").trim() || null;
    const notes = String(body.notes ?? "").trim() || null;
    const dateOfBirthRaw = String(body.dateOfBirth ?? "").trim();
    const dateOfBirth = dateOfBirthRaw ? new Date(dateOfBirthRaw) : null;
    const isActive = body.isActive !== false;
    const isPlayer = body.isPlayer === true;
    const isTrainer = body.isTrainer === true;

    const person = await prisma.person.create({
      data: {
        firstName,
        lastName,
        displayName,
        email,
        phone,
        notes,
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

    return NextResponse.json({ message: "Person erfolgreich erstellt.", person }, { status: 201 });
  } catch (error) {
    console.error("Create person failed:", error);
    return NextResponse.json({ error: "Person konnte nicht erstellt werden." }, { status: 500 });
  }
}
