import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus, RegistrationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = {
  params: Promise<{ registrationId: string }>;
};

const allowedTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
  NEW: ["IN_REVIEW", "APPROVED", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

function getPersonFlags(type: RegistrationType) {
  return {
    isPlayer: type === "PLAYER",
    isTrainer: type === "TRAINER",
  };
}

async function approveRegistration(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
  }

  if (registration.linkedPersonId) {
    return NextResponse.json(
      { error: "Diese Anmeldung ist bereits mit einer Person verknüpft." },
      { status: 409 },
    );
  }

  if (!allowedTransitions[registration.status].includes("APPROVED")) {
    return NextResponse.json(
      { error: `Statuswechsel von ${registration.status} zu APPROVED ist nicht erlaubt.` },
      { status: 409 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        firstName: registration.firstName,
        lastName: registration.lastName,
        displayName: registration.displayName,
        email: registration.email,
        phone: registration.phone,
        dateOfBirth: registration.dateOfBirth,
        notes: registration.notes,
        isActive: true,
        ...getPersonFlags(registration.type),
      },
    });

    const updated = await tx.registration.update({
      where: { id: registrationId },
      data: {
        status: "APPROVED",
        linkedPersonId: person.id,
      },
    });

    return { registration: updated, person };
  });

  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest, context: Context) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const { registrationId } = await context.params;
  const body = await request.json();

  const nextStatus = body.status as RegistrationStatus | undefined;

  if (!nextStatus) {
    return NextResponse.json({ error: "Status fehlt." }, { status: 400 });
  }

  if (!Object.values(RegistrationStatus).includes(nextStatus)) {
    return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  if (nextStatus === "APPROVED") {
    return approveRegistration(registrationId);
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
  }

  if (!allowedTransitions[registration.status].includes(nextStatus)) {
    return NextResponse.json(
      { error: `Statuswechsel von ${registration.status} zu ${nextStatus} ist nicht erlaubt.` },
      { status: 409 },
    );
  }

  const updated = await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: nextStatus,
      assignedTo: body.assignedTo ?? registration.assignedTo,
      notes: body.notes ?? registration.notes,
    },
  });

  return NextResponse.json({ registration: updated });
}

export async function POST(request: NextRequest, context: Context) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const { registrationId } = await context.params;
  const body = await request.json();

  if (body.action === "approve") {
    return approveRegistration(registrationId);
  }

  if (body.action === "reject") {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
    }

    if (!allowedTransitions[registration.status].includes("REJECTED")) {
      return NextResponse.json(
        { error: `Statuswechsel von ${registration.status} zu REJECTED ist nicht erlaubt.` },
        { status: 409 },
      );
    }

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ registration: updated });
  }

  return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 });
}
