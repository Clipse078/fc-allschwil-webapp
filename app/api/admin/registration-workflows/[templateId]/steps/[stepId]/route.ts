import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = {
  params: Promise<{ templateId: string; stepId: string }>;
};

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function parseDueDays(value: unknown) {
  const parsed = Number(value ?? 3);
  if (!Number.isInteger(parsed)) return 3;
  return Math.max(1, Math.min(90, parsed));
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { templateId, stepId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const title = clean(body.title);

  if (!title) return NextResponse.json({ error: "Titel fehlt." }, { status: 400 });

  const step = await prisma.registrationWorkflowTemplateStep.update({
    where: { id: stepId },
    data: {
      templateId,
      title,
      description: clean(body.description),
      defaultDueDays: parseDueDays(body.defaultDueDays),
      sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : undefined,
      assignedRoleId: clean(body.assignedRoleId),
      assignedPersonId: clean(body.assignedPersonId),
    },
    include: {
      assignedRole: { select: { id: true, key: true, name: true } },
      assignedPerson: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
    },
  });

  return NextResponse.json({ step, message: "Workflow-Schritt aktualisiert." });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { stepId } = await context.params;

  await prisma.registrationWorkflowTemplateStep.delete({
    where: { id: stepId },
  });

  return NextResponse.json({ message: "Workflow-Schritt gelöscht." });
}
