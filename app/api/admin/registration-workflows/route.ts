import { NextRequest, NextResponse } from "next/server";
import { RegistrationTargetGroup, RegistrationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const templates = await prisma.registrationWorkflowTemplate.findMany({
    orderBy: [{ targetGroup: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      responsibleRole: { select: { id: true, key: true, name: true } },
      responsiblePerson: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const name = clean(body.name);
  const targetGroup = clean(body.targetGroup);
  const registrationType = clean(body.registrationType);
  const responsibleRoleId = clean(body.responsibleRoleId);
  const responsiblePersonId = clean(body.responsiblePersonId);
  const defaultDueDays = Number(body.defaultDueDays ?? 7);

  if (!name) return NextResponse.json({ error: "Name fehlt." }, { status: 400 });
  if (!targetGroup || !Object.values(RegistrationTargetGroup).includes(targetGroup as RegistrationTargetGroup)) {
    return NextResponse.json({ error: "Ungültige Zielgruppe." }, { status: 400 });
  }
  if (registrationType && !Object.values(RegistrationType).includes(registrationType as RegistrationType)) {
    return NextResponse.json({ error: "Ungültiger Anmeldungstyp." }, { status: 400 });
  }
  if (!Number.isInteger(defaultDueDays) || defaultDueDays < 1 || defaultDueDays > 90) {
    return NextResponse.json({ error: "Standardfrist muss zwischen 1 und 90 Tagen liegen." }, { status: 400 });
  }

  const count = await prisma.registrationWorkflowTemplate.count({
    where: { targetGroup: targetGroup as RegistrationTargetGroup },
  });

  const template = await prisma.registrationWorkflowTemplate.create({
    data: {
      name,
      targetGroup: targetGroup as RegistrationTargetGroup,
      registrationType: registrationType ? (registrationType as RegistrationType) : null,
      responsibleRoleId,
      responsiblePersonId,
      defaultDueDays,
      sortOrder: count,
      isActive: body.isActive === false ? false : true,
    },
    include: {
      responsibleRole: { select: { id: true, key: true, name: true } },
      responsiblePerson: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
    },
  });

  return NextResponse.json({ template, message: "Workflow-Template gespeichert." }, { status: 201 });
}
