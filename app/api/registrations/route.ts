import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export async function GET() {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_VIEW]);

  const registrations = await prisma.registration.findMany({
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({ registrations });
}

export async function POST(request: NextRequest) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const body = await request.json();

  const registration = await prisma.registration.create({
    data: {
      type: body.type,
      status: body.status ?? "NEW",
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: body.displayName ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      assignedTo: body.assignedTo ?? null,
      notes: body.notes ?? null,
      formData: body.formData ?? null,
      submittedBy: body.submittedBy ?? null,
    },
  });

  return NextResponse.json({ registration });
}
