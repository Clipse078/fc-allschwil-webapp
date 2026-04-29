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

  const template = await prisma.registrationWorkflowTemplate.findFirst({
    where: {
      targetGroup,
      isActive: true,
      OR: [{ registrationType: body.type }, { registrationType: null }],
    },
    orderBy: [{ registrationType: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      registrationWorkflowTemplateSteps: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  const fallbackSteps = getDefaultWorkflowSteps(targetGroup);

  const templateSteps =
    template?.registrationWorkflowTemplateSteps && template.registrationWorkflowTemplateSteps.length > 0
      ? template.registrationWorkflowTemplateSteps.map((step) => ({
          title: step.title,
          description: step.description,
          sortOrder: step.sortOrder,
          defaultDueDays: step.defaultDueDays,
          assignedRoleId: step.assignedRoleId ?? template.responsibleRoleId,
          assignedPersonId: step.assignedPersonId ?? template.responsiblePersonId,
        }))
      : null;

  const workflowSteps = templateSteps
    ? templateSteps
    : template
      ? [
          {
            title: template.name,
            description: "Automatisch aus Admin Workflow-Template erstellt.",
            sortOrder: 10,
            defaultDueDays: template.defaultDueDays,
            assignedRoleId: template.responsibleRoleId,
            assignedPersonId: template.responsiblePersonId,
          },
          ...fallbackSteps.slice(1).map((step) => ({
            ...step,
            assignedRoleId: template.responsibleRoleId,
            assignedPersonId: template.responsiblePersonId,
          })),
        ]
      : fallbackSteps.map((step) => ({
          ...step,
          assignedRoleId: null,
          assignedPersonId: null,
        }));

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
        workflowTemplateId: template?.id ?? null,
      },
      submittedBy: body.submittedBy ?? null,
      workflowSteps: {
        create: workflowSteps.map((step) => ({
          title: step.title,
          description: step.description,
          sortOrder: step.sortOrder,
          dueDate: addDays(submittedAt, step.defaultDueDays),
          assignedRoleId: step.assignedRoleId,
          assignedPersonId: step.assignedPersonId,
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

