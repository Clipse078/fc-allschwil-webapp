import { NextRequest, NextResponse } from "next/server";
import {
  EventImportRunStatus,
  EventSource,
  EventStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { parseCsvEvents } from "@/lib/events/parse-csv-events";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.EVENTS_IMPORT);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei hochgeladen." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { error: "Aktuell werden nur CSV-Dateien unterstützt." },
      { status: 400 }
    );
  }

  const batchKey = randomUUID();

  const importRun = await prisma.eventImportRun.create({
    data: {
      source: EventSource.CSV_EXCEL_IMPORT,
      status: EventImportRunStatus.RUNNING,
      importBatchKey: batchKey,
      fileName: file.name,
      startedAt: new Date(),
    },
  });

  try {
    const parsedEvents = await parseCsvEvents(file);

    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
    });

    if (!activeSeason) {
      throw new Error("Keine aktive Saison gefunden.");
    }

    const teamSeasons = await prisma.teamSeason.findMany({
      where: {
        seasonId: activeSeason.id,
        team: { tenantId },
      },
      include: {
        team: true,
      },
    });

    type TeamSeasonCandidate = {
      teamId: string;
      teamSeasonId: string;
      teamName: string;
    };
    const teamMap = new Map<string, TeamSeasonCandidate[]>();

    function addTeamCandidate(label: string, candidate: TeamSeasonCandidate) {
      const key = normalize(label);
      const existing = teamMap.get(key) ?? [];
      if (!existing.some((item) => item.teamSeasonId === candidate.teamSeasonId)) {
        existing.push(candidate);
      }
      teamMap.set(key, existing);
    }

    for (const ts of teamSeasons) {
      const candidate = {
        teamId: ts.teamId,
        teamSeasonId: ts.id,
        teamName: ts.team.name,
      };
      addTeamCandidate(ts.team.name, candidate);
      addTeamCandidate("FC Allschwil " + ts.team.name, candidate);
    }

    let created = 0;

    for (const event of parsedEvents) {
      let teamId: string | null = null;
      let teamSeasonId: string | null = null;

      if (event.teamName) {
        const candidates = teamMap.get(normalize(event.teamName)) ?? [];

        if (candidates.length === 0) {
          throw new Error(
            "Team '" + event.teamName + "' existiert nicht in der aktiven Saison."
          );
        }

        if (candidates.length > 1) {
          throw new Error(
            "Team '" + event.teamName + "' ist in der aktiven Saison nicht eindeutig."
          );
        }

        const matchedTeam = candidates[0]!;
        teamId = matchedTeam.teamId;
        if (event.type === "TOURNAMENT") {
          teamSeasonId = matchedTeam.teamSeasonId;
        }
      }

      await prisma.event.create({
        data: {
          seasonId: activeSeason.id,
          teamId,
          teamSeasonId,
          tenantId,
          type: event.type,
          source: EventSource.CSV_EXCEL_IMPORT,
          status: EventStatus.SCHEDULED,
          title: event.title,
          location: event.location,
          startAt: event.startAt,
          endAt: event.endAt,
          opponentName: event.opponentName,
          organizerName: event.organizerName,
          competitionLabel: event.competitionLabel,
          homeAway: event.homeAway,
          importBatchKey: batchKey,
          websiteVisible: true,
          infoboardVisible: event.type !== "OTHER",
          homepageVisible: event.type !== "TRAINING",
          wochenplanVisible: event.type !== "OTHER",
          trainingsplanVisible: event.type === "TRAINING",
          teamPageVisible: !!teamId,
        },
      });

      created++;
    }

    await prisma.eventImportRun.update({
      where: { id: importRun.id },
      data: {
        status: EventImportRunStatus.COMPLETED,
        rowsDetected: parsedEvents.length,
        rowsCreated: created,
        rowsFailed: 0,
        finishedAt: new Date(),
        summary: "CSV Import erfolgreich abgeschlossen.",
      },
    });

    return NextResponse.json({
      message: "Import erfolgreich abgeschlossen.",
      created,
      batchKey,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unbekannter Importfehler.";

    await prisma.eventImportRun.update({
      where: { id: importRun.id },
      data: {
        status: EventImportRunStatus.FAILED,
        errorMessage,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}