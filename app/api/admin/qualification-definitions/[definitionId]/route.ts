import { NextRequest, NextResponse } from "next/server";
import { TrainerQualificationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = {
  params: Promise<{
    definitionId: string;
  }>;
};

const ALLOWED_TYPES = ["DIPLOMA", "CERTIFICATE", "COURSE", "WORKSHOP", "FIRST_AID", "OTHER"] as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE);

    const { definitionId } = await context.params;
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const type = String(body.type ?? "DIPLOMA").trim();
    const description = String(body.description ?? "").trim() || null;
    const isActive = Boolean(body.isActive ?? true);

    if (!name) return NextResponse.json({ error: "Name darf nicht leer sein." }, { status: 400 });
    if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
      return NextResponse.json({ error: "Ungültiger Qualifikationstyp." }, { status: 400 });
    }

    const definition = await prisma.qualificationDefinition.update({
      where: { id: definitionId },
      data: {
        name,
        type: type as TrainerQualificationType,
        description,
        isActive,
      },
    });

    return NextResponse.json({ definition });
  } catch (error) {
    console.error("Failed to update qualification definition", error);
    return NextResponse.json({ error: "Qualifikation konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE);

    const { definitionId } = await context.params;

    await prisma.qualificationDefinition.delete({
      where: { id: definitionId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete qualification definition", error);
    return NextResponse.json(
      { error: "Qualifikation konnte nicht gelöscht werden. Prüfe, ob sie noch in Teamregeln verwendet wird." },
      { status: 500 }
    );
  }
}
