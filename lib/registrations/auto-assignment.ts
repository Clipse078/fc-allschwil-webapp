import { prisma } from "@/lib/db/prisma";

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function findBestPersonIdForRole(
  tx: PrismaTransaction,
  roleId?: string | null,
) {
  if (!roleId) return null;

  const candidates = await tx.userRole.findMany({
    where: {
      roleId,
      user: {
        isActive: true,
        personId: { not: null },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      user: {
        select: { personId: true },
      },
    },
  });

  const personIds = candidates
    .map((candidate) => candidate.user.personId)
    .filter((personId): personId is string => Boolean(personId));

  if (personIds.length === 0) return null;

  const activeStepCounts = await tx.registrationWorkflowStep.groupBy({
    by: ["assignedPersonId"],
    where: {
      assignedPersonId: { in: personIds },
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
    },
    _count: { _all: true },
  });

  const countByPersonId = new Map(
    activeStepCounts.map((entry) => [entry.assignedPersonId, entry._count._all]),
  );

  const rankedCandidates = personIds
    .map((personId) => ({
      personId,
      activeStepCount: countByPersonId.get(personId) ?? 0,
    }))
    .sort((a, b) => a.activeStepCount - b.activeStepCount);

  return rankedCandidates[0]?.personId ?? null;
}
