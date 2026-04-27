import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = {
  params: Promise<{
    ruleId: string;
  }>;
};

function parseAllowedBirthYears(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1900 && item <= 2100);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE);

    const { ruleId } = await context.params;
    const body = await request.json();

    const minTrainerCount = Number(body.minTrainerCount);
    const requiredDiploma = String(body.requiredDiploma ?? "").trim();
    const allowedBirthYears = parseAllowedBirthYears(body.allowedBirthYears);

    if (!Number.isInteger(minTrainerCount) || minTrainerCount < 0 || minTrainerCount > 20) {
      return NextResponse.json(
        { error: "Traineranzahl muss zwischen 0 und 20 liegen." },
        { status: 400 }
      );
    }

    if (!requiredDiploma) {
      return NextResponse.json(
        { error: "Pflichtdiplom darf nicht leer sein." },
        { status: 400 }
      );
    }

    const updatedRule = await prisma.teamCategoryRule.update({
      where: { id: ruleId },
      data: {
        minTrainerCount,
        requiredDiploma,
        allowedBirthYears,
      },
    });

    return NextResponse.json({ rule: updatedRule });
  } catch (error) {
    console.error("Failed to update team category rule", error);

    return NextResponse.json(
      { error: "Teamregel konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE);

    const { ruleId } = await context.params;

    await prisma.teamCategoryRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete team category rule", error);

    return NextResponse.json(
      { error: "Teamkategorie konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}