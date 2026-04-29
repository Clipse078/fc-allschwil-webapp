import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { addDays, classifyRegistrationTargetGroup, getDefaultConversionRole, getDefaultWorkflowSteps } from "@/lib/registrations/registration-classification";

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
  const targetGroup = body.targetGroup ?? classifyRegistrationTargetGroup({
    type: body.type,
    dateOfBirth,
    gender: body.gender ?? null,
  });
  const conversionRole = body.conversionRole ?? getDefaultConversionRole(body.type);
  const submittedAt = new Date();
  const workflowSteps = getDefaultWorkflowSteps(targetGroup);

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
      formData: body.formData ?? null,
      submittedBy: body.submittedBy ?? null,
      workflowSteps: {
        create: workflowSteps.map((step) => ({
          title: step.title,
          description: step.description,
          sortOrder: step.sortOrder,
          dueDate: addDays(submittedAt, step.defaultDueDays),
        })),
      },
    },
    include: {
      workflowSteps: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ registration });
}
