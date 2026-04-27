import { NextRequest, NextResponse } from "next/server";
import { TrainerQualificationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const ALLOWED_TYPES = ["DIPLOMA", "CERTIFICATE", "COURSE", "WORKSHOP", "FIRST_AID", "OTHER"] as const;

function parseHierarchyLevel(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function fallbackHierarchyLevel(name: string, type: string) {
  if (type !== "DIPLOMA") return 0;

  const value = name.trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");

  if (!value) return 0;
  if (value.includes("a")) return 4;
  if (value.includes("b")) return 3;
  if (value.includes("c")) return 2;
  if (value.includes("d")) return 1;

  return 0;
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE);

    const body = await request.json();
    const clubConfigId = String(body.clubConfigId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const type = String(body.type ?? "DIPLOMA").trim();
    const description = String(body.description ?? "").trim() || null;
    const submittedHierarchyLevel = parseHierarchyLevel(body.hierarchyLevel);
    const hierarchyLevel = submittedHierarchyLevel > 0 ? submittedHierarchyLevel : fallbackHierarchyLevel(name, type);

    if (!clubConfigId) return NextResponse.json({ error: "ClubConfig fehlt." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Name darf nicht leer sein." }, { status: 400 });
    if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
      return NextResponse.json({ error: "Ungültiger Qualifikationstyp." }, { status: 400 });
    }

    const count = await prisma.qualificationDefinition.count({ where: { clubConfigId } });

    const definition = await prisma.qualificationDefinition.create({
      data: {
        clubConfigId,
        name,
        type: type as TrainerQualificationType,
        description,
        hierarchyLevel,
        sortOrder: count,
      },
    });

    return NextResponse.json({ definition }, { status: 201 });
  } catch (error) {
    console.error("Failed to create qualification definition", error);
    return NextResponse.json(
      { error: "Qualifikation konnte nicht erstellt werden. Prüfe, ob sie bereits existiert." },
      { status: 500 },
    );
  }
}
