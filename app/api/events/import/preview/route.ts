import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseCsvEventsWithMeta } from "@/lib/events/parse-csv-events";
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

  try {
    const parsed = await parseCsvEventsWithMeta(file);
    const parsedEvents = parsed.rows;
    const meta = parsed.meta;

    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
      },
    });

    if (!activeSeason) {
      return NextResponse.json(
        { error: "Keine aktive Saison gefunden." },
        { status: 400 }
      );
    }

    const teamSeasons = await prisma.teamSeason.findMany({
      where: {
        seasonId: activeSeason.id,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const teamMap = new Map<string, { teamId: string; teamName: string }>();

    for (const ts of teamSeasons) {
      teamMap.set(normalize(ts.team.name), {
        teamId: ts.teamId,
        teamName: ts.team.name,
      });

      teamMap.set(normalize("FC Allschwil " + ts.team.name), {
        teamId: ts.teamId,
        teamName: ts.team.name,
      });
    }

    const previewRows = parsedEvents.map((event, index) => {
      const matchedTeam =
        event.teamName ? teamMap.get(normalize(event.teamName)) : null;

      return {
        rowNumber: index + 2,
        title: event.title,
        type: event.type,
        teamName: event.teamName ?? null,
        matchedTeamName: matchedTeam?.teamName ?? null,
        matchedTeamId: matchedTeam?.teamId ?? null,
        opponentName: event.opponentName ?? null,
        organizerName: event.organizerName ?? null,
        competitionLabel: event.competitionLabel ?? null,
        homeAway: event.homeAway ?? null,
        location: event.location ?? null,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt ? event.endAt.toISOString() : null,
        hasTeamWarning: !!event.teamName && !matchedTeam,
      };
    });

    const warnings = previewRows
      .filter((row) => row.hasTeamWarning)
      .map(
        (row) =>
          "Zeile " +
          row.rowNumber +
          ": Team '" +
          row.teamName +
          "' existiert nicht in der aktiven Saison."
      );

    return NextResponse.json({
      activeSeason,
      rowsDetected: previewRows.length,
      warnings,
      rows: previewRows,
      csvMeta: meta,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unbekannter Vorschaufehler.";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}