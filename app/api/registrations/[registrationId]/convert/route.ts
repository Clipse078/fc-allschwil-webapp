import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = {
  params: Promise<{ registrationId: string }>;
};

export async function POST(_request: NextRequest, context: Context) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const { registrationId } = await context.params;

  const result = await prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return { error: "Anmeldung nicht gefunden.", status: 404 };
    }

    if (registration.linkedPersonId) {
      return { error: "Anmeldung bereits konvertiert.", status: 409 };
    }

    if (registration.status !== "APPROVED") {
      return { error: "Nur freigegebene Anmeldungen können als Person übernommen werden.", status: 409 };
    }

    const genderNote = registration.gender ? `Geschlecht aus Anmeldung: ${registration.gender}` : null;
    const notes = [registration.notes, genderNote].filter(Boolean).join("\n\n") || null;

    const person = await tx.person.create({
      data: {
        firstName: registration.firstName || "",
        lastName: registration.lastName || "",
        displayName: registration.displayName || null,
        email: registration.email || null,
        phone: registration.phone || null,
        dateOfBirth: registration.dateOfBirth || null,
        notes,
        isPlayer: registration.conversionRole === "PLAYER",
        isTrainer: registration.conversionRole === "TRAINER",
      },
    });

    await tx.registration.update({
      where: { id: registrationId },
      data: {
        status: "CONVERTED",
        linkedPersonId: person.id,
      },
    });

    return { personId: person.id };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
