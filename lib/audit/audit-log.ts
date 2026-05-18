/**
 * Governance audit logging — thin wrapper over lib/audit/log-action.ts.
 *
 * RULES:
 *   - Best-effort only. Audit failure NEVER throws or breaks the mutation.
 *   - logAction already catches all errors internally — this module inherits that.
 *   - Log AFTER successful DB mutation, not at guard success.
 *   - Avoid large payload snapshots — use minimal field sets only.
 *   - Never log sensitive allowlist content (visibleUserRefs etc.) as plain JSON.
 *
 * Action vocabulary (consistent across all governance modules):
 *   UPDATE           — entity fields updated
 *   DELETE           — entity deleted
 *   STAGE_CHANGE     — reviewStage transitioned
 *   LINKS_UPDATE     — cross-module refs updated
 *   DATAPOINT_CREATE — metric data point recorded
 *
 * Enforcement context logged as metadataJson where useful (e.g. fromStage/toStage).
 *
 * TODO: Phase B — structured audit viewer
 *   Build a governance audit trail page (/vereinsleitung/audit or admin/logs)
 *   that reads AuditLog and renders a timeline per entity with actor, action, diff.
 *
 * TODO: Phase B — before-state enrichment
 *   For UPDATE actions, fetch full before-state using a minimal select before
 *   the mutation and include as beforeJson for a complete diff trail.
 *
 * TODO: Phase B — async audit queue
 *   For high-frequency operations, emit audit events to a background queue
 *   (e.g. Inngest or BullMQ) rather than inline DB inserts to eliminate
 *   audit latency from the user's critical path.
 */

import { logAction } from "./log-action";

export type GovernanceAction =
  | "UPDATE"
  | "DELETE"
  | "STAGE_CHANGE"
  | "LINKS_UPDATE"
  | "DATAPOINT_CREATE";

export type GovernanceModule = "meetings" | "initiatives" | "targets";

const ENTITY_TYPE_MAP: Record<GovernanceModule, string> = {
  meetings: "Meeting",
  initiatives: "Initiative",
  targets: "Target",
};

type AuditEventInput = {
  actorUserId: string;
  module: GovernanceModule;
  entityId: string;
  action: GovernanceAction;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

/**
 * Emit a governance audit event.
 *
 * Best-effort — errors are caught internally by logAction and logged to
 * console.error. This function never throws and never rejects.
 *
 * Call AFTER a successful DB mutation. Use `void logAuditEvent(...)` for
 * fire-and-forget or `await logAuditEvent(...)` if you want to ensure the
 * log is written before responding (adds ~1 DB round-trip latency).
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  await logAction({
    actorUserId: input.actorUserId,
    moduleKey: input.module,
    entityType: ENTITY_TYPE_MAP[input.module],
    entityId: input.entityId,
    action: input.action,
    beforeJson: input.before ?? undefined,
    afterJson: input.after ?? undefined,
    metadataJson: input.metadata ?? undefined,
  });
}
