import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = {
  params: Promise<{ templateId: string }>;
};

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function parseDays(value: unknown) {
  const parsed = Number(value ?? 7);
  if (!Number.isInteger(parsed)) return 7;
  return Math.max(1, Math.min(90, parsed));
}

export async function GET(_request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { templateId } = await context.params;

  const steps = await prisma.registrationWorkflowTemplateStep.findMany({
    where: { templateId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      assignedRole: { select: { id: true, key: true, name: true } },
      assignedPerson: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
    },
  });

  return NextResponse.json({ steps });
}

export async function POST(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { templateId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const title = clean(body.title);
  if (!title) return NextResponse.json({ error: "Titel fehlt." }, { status: 400 });

  const template = await prisma.registrationWorkflowTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  });

  if (!template) return NextResponse.json({ error: "Workflow-Template nicht gefunden." }, { status: 404 });

  const count = await prisma.registrationWorkflowTemplateStep.count({ where: { templateId } });

  const step = await prisma.registrationWorkflowTemplateStep.create({
    data: {
      templateId,
      title,
      description: clean(body.description),
      defaultDueDays: parseDays(body.defaultDueDays),
      sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : (count + 1) * 10,
      assignedRoleId: clean(body.assignedRoleId),
      assignedPersonId: clean(body.assignedPersonId),
    },
    include: {
      assignedRole: { select: { id: true, key: true, name: true } },
      assignedPerson: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
    },
  });

  return NextResponse.json({ step, message: "Workflow-Schritt gespeichert." }, { status: 201 });
}
