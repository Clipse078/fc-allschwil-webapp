/**
 * lib/communication/audit-integration.ts
 *
 * COMM-01A: Integration point for future Verlauf / AuditLog events.
 *
 * Deferred in COMM-01A — no audit rows are written yet. Future slices will call
 * these helpers after successful communication mutations:
 *
 *   - E-Mail gesendet / zugestellt / fehlgeschlagen
 *   - Antwort eingegangen
 *   - Interner Kommentar erstellt
 *
 * Audit entries should reference/summarize the business event — never duplicate
 * full email/comment bodies into AuditLog.
 */

import type { CommunicationTargetType } from "@prisma/client";

export type CommunicationAuditEventKind =
  | "EMAIL_SENT"
  | "EMAIL_DELIVERED"
  | "EMAIL_FAILED"
  | "EMAIL_RECEIVED"
  | "INTERNAL_COMMENT_CREATED";

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

/**
 * Placeholder for COMM-01B+ Verlauf integration. Intentionally no-op in COMM-01A.
 */
export async function recordCommunicationAuditEvent(
  input: CommunicationAuditEventInput,
): Promise<void> {
  void input;
  // Deferred — see module header.
}
