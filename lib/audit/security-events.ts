import { logSecurityAction } from "@/lib/audit/log-action";

type RejectedPrivilegedActionInput = {
  actorUserId: string | null;
  effectiveUserId?: string | null;
  tenantId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  reasonCode: string;
};

/**
 * Rejected high-risk operations remain traceable without copying request
 * bodies or credentials into the audit payload. Audit unavailability must not
 * turn a rejection into an authorization bypass, so failures are reported only
 * to the structured application log.
 */
export async function auditRejectedPrivilegedAction(
  input: RejectedPrivilegedActionInput,
): Promise<void> {
  try {
    await logSecurityAction({
      actorUserId: input.actorUserId,
      effectiveUserId: input.effectiveUserId,
      tenantId: input.tenantId,
      moduleKey: "security",
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      outcome: "DENIED",
      metadataJson: { reasonCode: input.reasonCode },
    });
  } catch (error) {
    console.error("[security-audit] rejected action audit failed", {
      action: input.action,
      errorCategory:
        error instanceof Error && error.name ? error.name : "UnknownError",
    });
  }
}
