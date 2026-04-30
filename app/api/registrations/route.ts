import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createWorkflowForRegistration } from "@/lib/registrations/workflow-engine";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  classifyRegistrationTargetGroup,
  getDefaultConversionRole,
} from "@/lib/registrations/registration-classification";

export async function GET() {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_VIEW]);

  const registrations = await prisma.registration.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      workflowSteps: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ registrations });
}

export async function POST(request: NextRequest) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const body = await request.json();
  const dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;

  const targetGroup =
    body.targetGroup ??
    classifyRegistrationTargetGroup({
      type: body.type,
      dateOfBirth,
      gender: body.gender ?? null,
    });

  const conversionRole = body.conversionRole ?? getDefaultConversionRole(body.type);

  const registration = await prisma.registration.create({
    data: {
      type: body.type,
      status: body.status ?? "NEW",
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: body.displayName ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      dateOfBirth,
      gender: body.gender ?? null,
      targetGroup,
      conversionRole,
      assignedTo: body.assignedTo ?? null,
      notes: body.notes ?? null,
      formData: {
        ...(typeof body.formData === "object" && body.formData !== null ? body.formData : {}),
        source: body.source ?? body.formData?.source ?? "WEBAPP_MANUAL",
      },
      submittedBy: body.submittedBy ?? null,
    },
  });

  await createWorkflowForRegistration(registration.id);

  const hydratedRegistration = await prisma.registration.findUnique({
    where: { id: registration.id },
    include: {
      workflowSteps: {
        orderBy: { sortOrder: "asc" },
        include: {
          assignedRole: true,
          assignedPerson: true,
        },
      },
    },
  });

  return NextResponse.json({ registration: hydratedRegistration ?? registration });
}
