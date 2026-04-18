import { prisma } from "@/lib/db/prisma";

type LogActionInput = {
  actorUserId?: string | null;
  moduleKey: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadataJson?: unknown;
};

export async function logAction(input: LogActionInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        moduleKey: input.moduleKey,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        beforeJson: input.beforeJson ?? undefined,
        afterJson: input.afterJson ?? undefined,
        metadataJson: input.metadataJson ?? undefined,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}