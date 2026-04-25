import { NextRequest, NextResponse } from "next/server";
import { Prisma, TrainerQualificationStatus, TrainerQualificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{ personId: string; qualificationId: string }>;
};

const ALLOWED_TYPES = ["DIPLOMA", "CERTIFICATE", "COURSE", "WORKSHOP", "FIRST_AID", "OTHER"] as const;
const ALLOWED_STATUSES = ["VALID", "IN_PROGRESS", "EXPIRED", "PLANNED", "UNKNOWN"] as const;

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { personId, qualificationId } = await context.params;
    const body = await request.json();

    const existing = await prisma.trainerQualification.findUnique({
      where: { id: qualificationId },
      include: { person: { select: { firstName: true, lastName: true, displayName: true } } },
    });

    if (!existing || existing.personId !== personId) {
      return NextResponse.json({ error: "Trainer-Diplom nicht gefunden." }, { status: 404 });
    }

    const title = String(body.title ?? existing.title).trim();
    const type = String(body.type ?? existing.type).trim();
    const status = String(body.status ?? existing.status).trim();
    const issuer = String(body.issuer ?? "").trim() || null;
    const isClubVerified = Boolean(body.isClubVerified ?? existing.isClubVerified);

    if (!title) return NextResponse.json({ error: "Bitte einen Diplom- oder Kursnamen erfassen." }, { status: 400 });
    if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) return NextResponse.json({ error: "Ungültiger Diplom-Typ." }, { status: 400 });
    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) return NextResponse.json({ error: "Ungültiger Diplom-Status." }, { status: 400 });

    const updated = await prisma.trainerQualification.update({
      where: { id: qualificationId },
      data: {
        title,
        type: type as TrainerQualificationType,
        status: status as TrainerQualificationStatus,
        issuer,
        isClubVerified,
      },
    });

    await logAction({
      actorUserId: access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null,
      moduleKey: "teams",
      entityType: "TrainerQualification",
      entityId: qualificationId,
      action: "UPDATE",
      beforeJson: existing,
      afterJson: updated,
      metadataJson: {
        personId,
        personName: existing.person.displayName || existing.person.firstName + " " + existing.person.lastName,
      },
    });

    revalidatePath("/dashboard/teams");

    return NextResponse.json({
      message: "Trainer-Diplom erfolgreich aktualisiert.",
      qualification: {
        ...updated,
        issuedAt: updated.issuedAt?.toISOString() ?? null,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Update trainer qualification failed:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) return NextResponse.json({ error: "Datenbankfehler: " + error.code + "." }, { status: 500 });
    return NextResponse.json(
      { error: error instanceof Error ? "Technischer Fehler: " + error.message : "Trainer-Diplom konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { personId, qualificationId } = await context.params;

    const existing = await prisma.trainerQualification.findUnique({
      where: { id: qualificationId },
      include: { person: { select: { firstName: true, lastName: true, displayName: true } } },
    });

    if (!existing || existing.personId !== personId) {
      return NextResponse.json({ error: "Trainer-Diplom nicht gefunden." }, { status: 404 });
    }

    await prisma.trainerQualification.delete({ where: { id: qualificationId } });

    await logAction({
      actorUserId: access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null,
      moduleKey: "teams",
      entityType: "TrainerQualification",
      entityId: qualificationId,
      action: "DELETE",
      beforeJson: existing,
      metadataJson: {
        personId,
        personName: existing.person.displayName || existing.person.firstName + " " + existing.person.lastName,
      },
    });

    revalidatePath("/dashboard/teams");

    return NextResponse.json({ message: "Trainer-Diplom erfolgreich gelöscht." });
  } catch (error) {
    console.error("Delete trainer qualification failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? "Technischer Fehler: " + error.message : "Trainer-Diplom konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}