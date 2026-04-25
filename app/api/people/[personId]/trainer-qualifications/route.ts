import { NextRequest, NextResponse } from "next/server";
import { Prisma, TrainerQualificationStatus, TrainerQualificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{ personId: string }>;
};

const ALLOWED_TYPES = ["DIPLOMA", "CERTIFICATE", "COURSE", "WORKSHOP", "FIRST_AID", "OTHER"] as const;
const ALLOWED_STATUSES = ["VALID", "IN_PROGRESS", "EXPIRED", "PLANNED", "UNKNOWN"] as const;

function parseOptionalDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(_: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_VIEW);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { personId } = await context.params;
    const qualifications = await prisma.trainerQualification.findMany({
      where: { personId },
      orderBy: [{ expiresAt: "asc" }, { title: "asc" }],
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        issuer: true,
        licenseNumber: true,
        issuedAt: true,
        expiresAt: true,
        documentUrl: true,
        remarks: true,
        isClubVerified: true,
        isWebsiteVisible: true,
      },
    });

    return NextResponse.json(
      qualifications.map((qualification) => ({
        ...qualification,
        issuedAt: qualification.issuedAt?.toISOString() ?? null,
        expiresAt: qualification.expiresAt?.toISOString() ?? null,
      }))
    );
  } catch (error) {
    console.error("Load trainer qualifications failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? "Technischer Fehler: " + error.message : "Trainer-Diplome konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { personId } = await context.params;
    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const type = String(body.type ?? "DIPLOMA").trim();
    const status = String(body.status ?? "UNKNOWN").trim();
    const issuer = String(body.issuer ?? "").trim() || null;
    const licenseNumber = String(body.licenseNumber ?? "").trim() || null;
    const documentUrl = String(body.documentUrl ?? "").trim() || null;
    const remarks = String(body.remarks ?? "").trim() || null;
    const issuedAt = parseOptionalDate(body.issuedAt);
    const expiresAt = parseOptionalDate(body.expiresAt);
    const isClubVerified = Boolean(body.isClubVerified ?? false);
    const isWebsiteVisible = false;

    if (!title) return NextResponse.json({ error: "Bitte einen Diplom- oder Kursnamen erfassen." }, { status: 400 });
    if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) return NextResponse.json({ error: "Ungültiger Diplom-Typ." }, { status: 400 });
    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) return NextResponse.json({ error: "Ungültiger Diplom-Status." }, { status: 400 });

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, firstName: true, lastName: true, displayName: true, isTrainer: true },
    });

    if (!person) return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
    if (!person.isTrainer) return NextResponse.json({ error: "Diplome können nur bei Trainern hinterlegt werden." }, { status: 400 });

    const created = await prisma.trainerQualification.create({
      data: {
        personId,
        type: type as TrainerQualificationType,
        status: status as TrainerQualificationStatus,
        title,
        issuer,
        licenseNumber,
        issuedAt,
        expiresAt,
        documentUrl,
        remarks,
        isClubVerified,
        isWebsiteVisible,
      },
    });

    await logAction({
      actorUserId: access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null,
      moduleKey: "teams",
      entityType: "TrainerQualification",
      entityId: created.id,
      action: "CREATE",
      afterJson: { personId, type, status, title, issuer, licenseNumber, issuedAt, expiresAt, documentUrl, remarks, isClubVerified, isWebsiteVisible },
      metadataJson: { personName: person.displayName || person.firstName + " " + person.lastName },
    });

    revalidatePath("/dashboard/teams");

    return NextResponse.json(
      {
        message: "Trainer-Diplom erfolgreich hinterlegt.",
        qualification: {
          ...created,
          issuedAt: created.issuedAt?.toISOString() ?? null,
          expiresAt: created.expiresAt?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create trainer qualification failed:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) return NextResponse.json({ error: "Datenbankfehler: " + error.code + "." }, { status: 500 });
    return NextResponse.json(
      { error: error instanceof Error ? "Technischer Fehler: " + error.message : "Trainer-Diplom konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}