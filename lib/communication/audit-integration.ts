/**
 * lib/communication/audit-integration.ts
 *
 * COMM-01B: Verlauf / AuditLog integration for communication events.
 *
 * Audit entries reference/summarize the business event — never duplicate
 * full email/comment bodies into AuditLog.
 */

import type { CommunicationTargetType } from "@prisma/client";
import { logAction } from "@/lib/audit/log-action";

export type CommunicationAuditEventKind =
  | "EMAIL_SENT"
  | "EMAIL_DELIVERED"
  | "EMAIL_FAILED"
  | "EMAIL_RECEIVED"
  | "INTERNAL_COMMENT_CREATED"
  | "INTERNAL_COMMENT_UPDATED"
  | "INTERNAL_COMMENT_DELETED";

export type CommunicationAuditEventInput = {
  tenantId: string;
  actorUserId?: string | null;
  kind: CommunicationAuditEventKind;
  threadId: string;
  targetType: CommunicationTargetType;
  targetId: string;
  entityId: string;
  summary: string;
};

function resolveAuditEntity(targetType: CommunicationTargetType, targetId: string) {
  switch (targetType) {
    case "REGISTRATION":
      return { entityType: "Registration", entityId: targetId };
    case "WAITING_LIST_ENTRY":
      return { entityType: "WaitingListEntry", entityId: targetId };
    default:
      return { entityType: "CommunicationThread", entityId: targetId };
  }
}

export async function recordCommunicationAuditEvent(
  input: CommunicationAuditEventInput,
): Promise<void> {
  const { entityType, entityId } = resolveAuditEntity(input.targetType, input.targetId);

  await logAction({
    actorUserId: input.actorUserId ?? null,
    moduleKey: "registrations",
    entityType,
    entityId,
    action: input.kind,
    afterJson: {
      threadId: input.threadId,
      targetType: input.targetType,
      targetId: input.targetId,
      commentId: input.entityId,
      summary: input.summary,
    },
  });
}
