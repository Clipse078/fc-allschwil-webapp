import { NextRequest, NextResponse } from "next/server";
import { RegistrationTargetGroup, RegistrationType } from "@prisma/client";
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

function parseDueDays(value: unknown) {
  const parsed = Number(value ?? 7);
  if (!Number.isInteger(parsed)) return 7;
  return Math.max(1, Math.min(90, parsed));
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { templateId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const name = clean(body.name);
  const targetGroup = clean(body.targetGroup);
  const registrationType = clean(body.registrationType);

  if (targetGroup && !Object.values(RegistrationTargetGroup).includes(targetGroup as RegistrationTargetGroup)) {
    return NextResponse.json({ error: "Ungültige Zielgruppe." }, { status: 400 });
  }

  if (registrationType && !Object.values(RegistrationType).includes(registrationType as RegistrationType)) {
    return NextResponse.json({ error: "Ungültiger Anmeldungstyp." }, { status: 400 });
  }

  const template = await prisma.registrationWorkflowTemplate.update({
    where: { id: templateId },
    data: {
      ...(name ? { name } : {}),
      ...(targetGroup ? { targetGroup: targetGroup as RegistrationTargetGroup } : {}),
      registrationType: registrationType ? (registrationType as RegistrationType) : null,
      responsibleRoleId: clean(body.responsibleRoleId),
      responsiblePersonId: clean(body.responsiblePersonId),
      defaultDueDays: parseDueDays(body.defaultDueDays),
      isActive: body.isActive === false ? false : true,
    },
  });

  return NextResponse.json({ template, message: "Workflow-Template aktualisiert." });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { templateId } = await context.params;

  await prisma.registrationWorkflowTemplate.delete({
    where: { id: templateId },
  });

  return NextResponse.json({ message: "Workflow-Template gelöscht." });
}
