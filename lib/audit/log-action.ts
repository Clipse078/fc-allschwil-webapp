import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  writeAuditRecord,
  type LogActionInput,
} from "@/lib/audit/audit-record";

export {
  buildAuditData,
  sanitizeAuditValue,
  writeAuditRecord,
  type AuditOutcome,
  type LogActionInput,
} from "@/lib/audit/audit-record";

async function withRequestAuditContext(
  input: LogActionInput,
): Promise<LogActionInput> {
  let actorUserId = input.actorUserId ?? null;
  let effectiveUserId = input.effectiveUserId ?? null;
  let tenantId = input.tenantId;

  if (actorUserId) {
    try {
      const session = await auth();
      if (session?.user) {
        const sessionEffectiveUserId =
          session.user.effectiveUserId ?? session.user.id;
        effectiveUserId = sessionEffectiveUserId;

        if (session.user.isImpersonating && session.user.actorUserId) {
          actorUserId = session.user.actorUserId;
        }

        if (tenantId === undefined) {
          tenantId = session.user.activeTenantId ?? null;
        } else if (
          tenantId !== null &&
          session.user.activeTenantId &&
          tenantId !== session.user.activeTenantId
        ) {
          throw new Error("Audit tenant does not match the active tenant");
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Audit tenant does not match the active tenant"
      ) {
        throw error;
      }
      // Auth context is unavailable in scripts/background work. Preserve the
      // explicit actor and tenant supplied by that trusted server caller.
    }
  }

  return { ...input, actorUserId, effectiveUserId, tenantId };
}

/**
 * Best-effort compatibility wrapper for ordinary operational CRUD.
 * Security-sensitive mutations use writeAuditRecord() transactionally.
 */
export async function logAction(input: LogActionInput) {
  try {
    await writeAuditRecord(prisma, await withRequestAuditContext(input));
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}

/** Durable request-context writer for rejected or non-transactional events. */
export async function logSecurityAction(input: LogActionInput): Promise<void> {
  await writeAuditRecord(prisma, await withRequestAuditContext(input));
}