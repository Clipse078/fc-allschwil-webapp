import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

type LogActionInput = {
  tenantId?: string | null;
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
    let actorUserId = input.actorUserId ?? null;
    let metadataJson = input.metadataJson;

    // Audit the human who authenticated, not only the effective identity whose
    // permissions are being exercised. Non-request/system audit events keep
    // their explicitly supplied actor unchanged.
    if (actorUserId) {
      try {
        const session = await auth();
        if (session?.user.isImpersonating && session.user.actorUserId) {
          actorUserId = session.user.actorUserId;
          metadataJson = {
            ...(metadataJson &&
            typeof metadataJson === "object" &&
            !Array.isArray(metadataJson)
              ? metadataJson
              : metadataJson === undefined
                ? {}
                : { originalMetadata: metadataJson }),
            actorUserId,
            effectiveUserId:
              session.user.effectiveUserId ?? session.user.id,
          };
        }
      } catch {
        // Auth context is unavailable in scripts/background work. Preserve the
        // explicit actor supplied by that trusted server caller.
      }
    }

    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId,
        moduleKey: input.moduleKey,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        beforeJson: input.beforeJson ?? undefined,
        afterJson: input.afterJson ?? undefined,
        metadataJson: metadataJson ?? undefined,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}