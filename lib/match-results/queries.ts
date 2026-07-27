/**
 * lib/match-results/queries.ts
 *
 * Database port definitions and query helpers for match-results.
 *
 * Architecture invariants:
 *   - Injectable database ports — all public functions accept a `database`
 *     argument so tests can supply in-memory fakes without a live DB.
 *   - No provider-specific imports. No SFV / ClubCorner references.
 *   - All queries are tenant-scoped to prevent cross-tenant data leakage.
 *   - This module does not import from lib/integrations or lib/matchcenter.
 *   - Status mapping is delegated to types.ts to avoid circular imports.
 */

import type { MatchResult, MatchStatus } from "./types";
import {
  resolveCanonicalStatus,
  toEventStatus,
} from "./types";

// ── DB port types ──────────────────────────────────────────────────────────

/** Minimal event record required for result operations. */
export interface MatchResultEventRecord {
  id: string;
  tenantId: string | null;
  status: string;
  startAt: Date;
  updatedAt: Date;
  type: string;
  matchExternalMapping: MatchResultMappingRecord | null;
}

/** Minimal mapping record required for result operations. */
export interface MatchResultMappingRecord {
  id: string;
  tenantId: string;
  provider: string;
  providerMatchState: number | null;
  providerMatchStateName: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  lastSyncedAt: Date;
}

interface MatchResultEventDelegate {
  findFirst(args: object): Promise<MatchResultEventRecord | null>;
  update(args: object): Promise<MatchResultEventRecord>;
}

interface MatchResultMappingDelegate {
  update(args: object): Promise<MatchResultMappingRecord>;
}

interface AuditLogDelegate {
  create(args: object): Promise<unknown>;
}

/** Injectable database port for the match-results module. */
export interface MatchResultDatabase {
  event: MatchResultEventDelegate;
  matchExternalMapping: MatchResultMappingDelegate;
  auditLog: AuditLogDelegate;
}

// ── Query helpers ──────────────────────────────────────────────────────────

const matchResultEventSelect = {
  id: true,
  tenantId: true,
  status: true,
  startAt: true,
  updatedAt: true,
  type: true,
  matchExternalMapping: {
    select: {
      id: true,
      tenantId: true,
      provider: true,
      providerMatchState: true,
      providerMatchStateName: true,
      scoreHome: true,
      scoreAway: true,
      lastSyncedAt: true,
    },
  },
} as const;

/**
 * Load a single MATCH event by id and tenantId.
 *
 * Returns null when the event does not exist or does not belong to the tenant.
 */
export async function loadMatchEvent(
  database: MatchResultDatabase,
  matchId: string,
  tenantId: string,
): Promise<MatchResultEventRecord | null> {
  return database.event.findFirst({
    where: {
      id: matchId,
      tenantId,
      type: "MATCH",
    },
    select: matchResultEventSelect,
  });
}

/**
 * Persist a canonical result update.
 *
 * Updates Event.status and Event.resultLabel. When a MatchExternalMapping
 * is attached, also updates scores and provider state fields.
 *
 * Returns the refreshed event record.
 */
export async function persistMatchResult(
  database: MatchResultDatabase,
  args: {
    eventId: string;
    status: MatchStatus;
    homeGoals: number | null;
    awayGoals: number | null;
    resultLabel: string | null;
    providerState: number | null;
    providerStateLabel: string | null;
    mappingId: string | null;
    syncedAt: Date;
  },
): Promise<MatchResultEventRecord> {
  const eventStatus = toEventStatus(args.status);

  if (args.mappingId !== null) {
    await database.matchExternalMapping.update({
      where: { id: args.mappingId },
      data: {
        scoreHome: args.homeGoals,
        scoreAway: args.awayGoals,
        providerMatchState: args.providerState,
        providerMatchStateName: args.providerStateLabel,
        lastSyncedAt: args.syncedAt,
      },
    });
  }

  return database.event.update({
    where: { id: args.eventId },
    data: {
      status: eventStatus,
      resultLabel: args.resultLabel,
    },
    select: matchResultEventSelect,
  });
}

/**
 * Record a match result audit entry.
 *
 * Best-effort — errors are swallowed to match the audit module convention.
 */
export async function recordResultAudit(
  database: MatchResultDatabase,
  args: {
    eventId: string;
    action: string;
    provider: string;
    before: unknown;
    after: unknown;
  },
): Promise<void> {
  try {
    await database.auditLog.create({
      data: {
        moduleKey: "match-results",
        entityType: "MatchResult",
        entityId: args.eventId,
        action: args.action,
        beforeJson: args.before,
        afterJson: args.after,
        metadataJson: { provider: args.provider },
      },
    });
  } catch {
    // Best-effort: audit failure must never break the mutation
  }
}

/**
 * Convert a raw event record to a canonical MatchResult DTO.
 *
 * Exported so the service and tests share the same mapping logic.
 */
export function toMatchResult(
  event: MatchResultEventRecord,
  warnings: string[] = [],
): MatchResult {
  const mapping = event.matchExternalMapping;

  return {
    matchId: event.id,
    tenantId: event.tenantId ?? "",
    homeGoals: mapping?.scoreHome ?? null,
    awayGoals: mapping?.scoreAway ?? null,
    status: resolveCanonicalStatus(event.status),
    playedAt: event.startAt,
    lastUpdated: mapping?.lastSyncedAt ?? event.updatedAt,
    provider: mapping?.provider ?? null,
    providerState: mapping?.providerMatchState ?? null,
    providerStateLabel: mapping?.providerMatchStateName ?? null,
    warnings,
  };
}
