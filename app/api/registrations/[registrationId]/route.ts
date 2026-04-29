import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = {
  params: Promise<{ registrationId: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const { registrationId } = await context.params;
  const body = await request.json();

  const registration = await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: body.status ?? undefined,
      assignedTo: body.assignedTo ?? undefined,
      notes: body.notes ?? undefined,
    },
  });

  return NextResponse.json({ registration });
}

export async function POST(request: NextRequest, context: Context) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const { registrationId } = await context.params;
  const body = await request.json();

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "approve") {
    const person = await prisma.person.create({
      data: {
        firstName: registration.firstName,
        lastName: registration.lastName,
        displayName: registration.displayName,
        email: registration.email,
        phone: registration.phone,
        dateOfBirth: registration.dateOfBirth,
        isPlayer: registration.type === "PLAYER",
        isTrainer: registration.type === "TRAINER",
        isActive: true,
      },
    });

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: "APPROVED",
        linkedPersonId: person.id,
      },
    });

    return NextResponse.json({ registration: updated, person });
  }

  if (body.action === "reject") {
    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ registration: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
