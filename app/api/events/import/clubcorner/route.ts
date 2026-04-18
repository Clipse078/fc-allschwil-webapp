import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.EVENTS_IMPORT);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const mode = String(body?.mode ?? "foundation_prepare").trim();
    const importBatchKey = "clubcorner-foundation-" + Date.now();

    const run = await prisma.eventImportRun.create({
      data: {
        source: "CLUBCORNER_FVNWS",
        status: "COMPLETED",
        importBatchKey,
        summary: "ClubCorner / fvnws Sync Foundation initialisiert.",
        metadataJson: {
          mode,
          preparedBy: "events-import-foundation",
        },
      },
      select: {
        id: true,
        importBatchKey: true,
        status: true,
      },
    });

    return NextResponse.json({
      message: "ClubCorner / fvnws Sync Foundation erfolgreich vorbereitet.",
      importRun: run,
    });
  } catch (error) {
    console.error("Prepare clubcorner import foundation failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "ClubCorner / fvnws Foundation konnte nicht vorbereitet werden." },
      { status: 500 }
    );
  }
}