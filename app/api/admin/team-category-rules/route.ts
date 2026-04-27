import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function parseAllowedBirthYears(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1900 && item <= 2100);
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE);

    const body = await request.json();

    const clubConfigId = String(body.clubConfigId ?? "").trim();
    const category = String(body.category ?? "").trim().toUpperCase();
    const minTrainerCount = Number(body.minTrainerCount);
    const requiredDiploma = String(body.requiredDiploma ?? "").trim();
    const requiredDiplomaTrainerCount = Number(body.requiredDiplomaTrainerCount ?? 1);
    const allowedBirthYears = parseAllowedBirthYears(body.allowedBirthYears);

    if (!clubConfigId) {
      return NextResponse.json({ error: "ClubConfig fehlt." }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ error: "Kategorie darf nicht leer sein." }, { status: 400 });
    }

    if (!Number.isInteger(minTrainerCount) || minTrainerCount < 0 || minTrainerCount > 20) {
      return NextResponse.json({ error: "Traineranzahl muss zwischen 0 und 20 liegen." }, { status: 400 });
    }

    if (!requiredDiploma) {
      return NextResponse.json({ error: "Pflichtdiplom darf nicht leer sein." }, { status: 400 });
    }

    if (!Number.isInteger(requiredDiplomaTrainerCount) || requiredDiplomaTrainerCount < 0 || requiredDiplomaTrainerCount > 20) {
      return NextResponse.json({ error: "Diplom-Anzahl muss zwischen 0 und 20 liegen." }, { status: 400 });
    }

    const rule = await prisma.teamCategoryRule.create({
      data: {
        clubConfigId,
        category,
        minTrainerCount,
        requiredDiploma,
        requiredDiplomaTrainerCount,
        allowedBirthYears,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Failed to create team category rule", error);

    return NextResponse.json(
      { error: "Teamkategorie konnte nicht erstellt werden. Prüfe, ob sie bereits existiert." },
      { status: 500 }
    );
  }
}
export async function PATCH(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE);

    const body = await request.json();
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.map((id: unknown) => String(id))
      : [];

    if (orderedIds.length === 0) {
      return NextResponse.json({ error: "Keine Sortierung erhalten." }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id: string, index: number) =>
        prisma.teamCategoryRule.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to reorder team category rules", error);

    return NextResponse.json(
      { error: "Sortierung konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}