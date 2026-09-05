import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import type { PrismaClient } from "@prisma/client";

export type AuditOutcome = "SUCCESS" | "DENIED" | "FAILURE";

export type LogActionInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  effectiveUserId?: string | null;
  moduleKey: string;
  entityType: string;
  entityId: string;
  action: string;
  outcome?: AuditOutcome;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadataJson?: unknown;
};

type AuditWriter = Pick<PrismaClient, "auditLog">;

const SENSITIVE_AUDIT_KEY =
  /(?:password|passphrase|hash|token|secret|credential|authorization|cookie|otp|capability|api.?key|private.?key|storage.?key|blob|url|uri)/i;
const MAX_AUDIT_DEPTH = 6;
const MAX_AUDIT_COLLECTION_SIZE = 100;
const MAX_AUDIT_STRING_LENGTH = 2_000;

/**
 * Defense-in-depth for every canonical AuditLog write. Call sites must still
 * select minimal metadata, but this prevents common credentials, reset/invite
 * tokens, password hashes, signed URLs, and private storage references from
 * being persisted when a caller makes a mistake.
 */
export function sanitizeAuditValue(
  value: unknown,
  depth = 0,
): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_AUDIT_DEPTH) return "[TRUNCATED]";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    return value.length > MAX_AUDIT_STRING_LENGTH
      ? `${value.slice(0, MAX_AUDIT_STRING_LENGTH)}[TRUNCATED]`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_AUDIT_COLLECTION_SIZE)
      .map((entry) => sanitizeAuditValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_AUDIT_COLLECTION_SIZE)
        .filter(([key]) => !SENSITIVE_AUDIT_KEY.test(key))
        .map(([key, entry]) => [key, sanitizeAuditValue(entry, depth + 1)]),
    );
  }
  return String(value);
}

export function buildAuditData(input: LogActionInput) {
  const sanitizedMetadata = sanitizeAuditValue(input.metadataJson);
  const metadata =
    sanitizedMetadata &&
    typeof sanitizedMetadata === "object" &&
    !Array.isArray(sanitizedMetadata)
      ? sanitizedMetadata as Record<string, unknown>
      : sanitizedMetadata === undefined
        ? {}
        : { context: sanitizedMetadata };

  return {
    tenantId: input.tenantId ?? null,
    actorUserId: input.actorUserId ?? null,
    moduleKey: input.moduleKey,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    beforeJson: sanitizeAuditValue(input.beforeJson) ?? undefined,
    afterJson: sanitizeAuditValue(input.afterJson) ?? undefined,
    metadataJson: {
      ...metadata,
      outcome: input.outcome ?? "SUCCESS",
      ...(input.effectiveUserId &&
      input.effectiveUserId !== input.actorUserId
        ? {
            actorUserId: input.actorUserId ?? null,
            effectiveUserId: input.effectiveUserId,
          }
        : {}),
    },
  };
}

/**
 * Strict writer for security-sensitive mutations. Use this with the mutation's
 * transaction client so the business change and its audit record commit or
 * roll back together.
 */
export async function writeAuditRecord(
  client: AuditWriter,
  input: LogActionInput,
): Promise<void> {
  await client.auditLog.create({
    data: buildAuditData(input) as never,
  });
}

async function withRequestAuditContext(
  input: LogActionInput,
): Promise<LogActionInput> {
  let actorUserId = input.actorUserId ?? null;
  let effectiveUserId = input.effectiveUserId ?? null;
  let tenantId = input.tenantId;

  if (actorUserId || tenantId === undefined) {
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