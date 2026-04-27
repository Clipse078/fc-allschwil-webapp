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
  return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 1900 && item <= 2100);
}

function parseRequirements(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const record = item as { qualificationDefinitionId?: unknown; requiredTrainerCount?: unknown };
      return {
        qualificationDefinitionId: String(record.qualificationDefinitionId ?? "").trim(),
        requiredTrainerCount: Number(record.requiredTrainerCount ?? 1),
        sortOrder: index,
      };
    })
    .filter(
      (item) =>
        item.qualificationDefinitionId &&
        Number.isInteger(item.requiredTrainerCount) &&
        item.requiredTrainerCount >= 0 &&
        item.requiredTrainerCount <= 20
    );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE);

    const { ruleId } = await context.params;
    const body = await request.json();

    const minTrainerCount = Number(body.minTrainerCount);
    const maxPlayersPerTrainer = Number(body.maxPlayersPerTrainer ?? 10);
    const allowedBirthYears = parseAllowedBirthYears(body.allowedBirthYears);
    const qualificationRequirements = parseRequirements(body.qualificationRequirements);

    if (!Number.isInteger(minTrainerCount) || minTrainerCount < 0 || minTrainerCount > 20) {
      return NextResponse.json({ error: "Traineranzahl muss zwischen 0 und 20 liegen." }, { status: 400 });
    }

    if (!Number.isInteger(maxPlayersPerTrainer) || maxPlayersPerTrainer < 1 || maxPlayersPerTrainer > 50) {
      return NextResponse.json({ error: "Spieler pro Trainer muss zwischen 1 und 50 liegen." }, { status: 400 });
    }

    const updatedRule = await prisma.$transaction(async (tx) => {
      await tx.teamCategoryQualificationRequirement.deleteMany({
        where: { teamCategoryRuleId: ruleId },
      });

      return tx.teamCategoryRule.update({
        where: { id: ruleId },
        data: {
          minTrainerCount,
          maxPlayersPerTrainer,
          allowedBirthYears,
          qualificationRequirements: {
            create: qualificationRequirements.map((requirement) => ({
              qualificationDefinitionId: requirement.qualificationDefinitionId,
              requiredTrainerCount: requirement.requiredTrainerCount,
              sortOrder: requirement.sortOrder,
            })),
          },
        },
        include: {
          qualificationRequirements: {
            include: { qualificationDefinition: true },
            orderBy: [{ sortOrder: "asc" }],
          },
        },
      });
    });

    return NextResponse.json({ rule: updatedRule });
  } catch (error) {
    console.error("Failed to update team category rule", error);
    return NextResponse.json({ error: "Teamregel konnte nicht gespeichert werden." }, { status: 500 });
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
    return NextResponse.json({ error: "Teamkategorie konnte nicht gelöscht werden." }, { status: 500 });
  }
}
