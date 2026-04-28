import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPlayerRatingPermissionReasons } from "@/lib/players/player-rating-permissions";

type Context = {
  params: Promise<{ personId: string }>;
};

function rating(value: unknown, fallback = 50) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function optionalRating(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return rating(value);
}

function calculateOverallFromFields(input: {
  potentialRating: number | null;
  technicalRating: number | null;
  tacticalRating: number | null;
  physicalRating: number | null;
  mentalityRating: number | null;
  socialRating: number | null;
}) {
  const values = [
    input.potentialRating,
    input.technicalRating,
    input.tacticalRating,
    input.physicalRating,
    input.mentalityRating,
    input.socialRating,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) return 50;

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

async function assertPlayer(personId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, isPlayer: true },
  });

  return person && person.isPlayer ? person : null;
}

async function assertCanRatePlayer(personId: string, seasonId: string) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_VIEW);

  if (!access.ok) {
    return {
      ok: false as const,
      status: access.status,
      error: access.error,
    };
  }

  const actorUserId = access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

  const permission = await getPlayerRatingPermissionReasons({
    userId: actorUserId,
    personId,
    seasonId,
  });

  if (!permission.canRate) {
    return {
      ok: false as const,
      status: 403,
      error: `Du darfst diesen Spieler in dieser Saison nicht bewerten. Grund: ${permission.reasons.join(", ")}`,
    };
  }

  return {
    ok: true as const,
    status: 200,
    error: null,
  };
}

async function saveRating(request: NextRequest, context: Context) {
  const { personId } = await context.params;
  const body = await request.json().catch(() => ({}));

  if (!body?.seasonId) {
    return NextResponse.json({ error: "seasonId fehlt." }, { status: 400 });
  }

  const person = await assertPlayer(personId);

  if (!person) {
    return NextResponse.json({ error: "Spieler nicht gefunden." }, { status: 404 });
  }

  const season = await prisma.season.findUnique({
    where: { id: body.seasonId },
    select: { id: true },
  });

  if (!season) {
    return NextResponse.json({ error: "Saison nicht gefunden." }, { status: 404 });
  }

const ratingAccess = await assertCanRatePlayer(personId, body.seasonId);

  if (!ratingAccess.ok) {
    return NextResponse.json({ error: ratingAccess.error }, { status: ratingAccess.status });
  }

  const fieldRatings = {
    potentialRating: optionalRating(body.potentialRating),
    technicalRating: optionalRating(body.technicalRating),
    tacticalRating: optionalRating(body.tacticalRating),
    physicalRating: optionalRating(body.physicalRating),
    mentalityRating: optionalRating(body.mentalityRating),
    socialRating: optionalRating(body.socialRating),
  };

  const overallRating = calculateOverallFromFields(fieldRatings);

  const ratingRecord = await prisma.playerSeasonRating.upsert({
    where: {
      personId_seasonId: {
        personId,
        seasonId: body.seasonId,
      },
    },
    update: {
      overallRating,
      ...fieldRatings,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    },
    create: {
      personId,
      seasonId: body.seasonId,
      overallRating,
      ...fieldRatings,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    },
    include: {
      season: {
        select: {
          id: true,
          key: true,
          name: true,
          isActive: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  return NextResponse.json({
    message: "Spielerbewertung gespeichert.",
    rating: ratingRecord,
  });
}

export async function GET(_: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_VIEW);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { personId } = await context.params;

  const ratings = await prisma.playerSeasonRating.findMany({
    where: { personId },
    orderBy: { season: { startDate: "desc" } },
    include: {
      season: {
        select: {
          id: true,
          key: true,
          name: true,
          isActive: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  return NextResponse.json(ratings);
}

export async function POST(request: NextRequest, context: Context) {
  return saveRating(request, context);
}

export async function PATCH(request: NextRequest, context: Context) {
  return saveRating(request, context);
}

export async function DELETE(request: NextRequest, context: Context) {
  const { personId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const seasonId = String(body?.seasonId ?? "").trim();

  if (!seasonId) {
    return NextResponse.json({ error: "seasonId fehlt." }, { status: 400 });
  }

  const ratingAccess = await assertCanRatePlayer(personId, seasonId);

  if (!ratingAccess.ok) {
    return NextResponse.json({ error: ratingAccess.error }, { status: ratingAccess.status });
  }

  await prisma.playerSeasonRating.deleteMany({
    where: {
      personId,
      seasonId,
    },
  });

  return NextResponse.json({ message: "Spielerbewertung gelöscht." });
}




