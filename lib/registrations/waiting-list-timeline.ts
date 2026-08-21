/**
 * lib/registrations/waiting-list-timeline.ts
 *
 * REG-WAIT-01J — Waiting-list Verlauf with accountable actor identity.
 * Built from WaitingListEntry audit logs with legacy timestamp fallbacks.
 */

import type { WaitingListStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { resolveAuditActorDisplayName, type AuditActorShape } from "@/lib/registrations/actor-display";
import { WAITING_LIST_STATUS_LABELS } from "@/lib/registrations/waiting-list-ui";

export type WaitingListTimelineEntry = {
  id: string;
  label: string;
  actorName: string | null;
  occurredAt: string;
};

const TERMINAL_STATUSES: WaitingListStatus[] = ["PLACED", "WITHDRAWN", "REJECTED", "ARCHIVED"];

type AuditActorRecord = AuditActorShape | null;

function actorName(actor: AuditActorRecord): string | null {
  return resolveAuditActorDisplayName(actor);
}

function auditActorSelect(tenantId: string) {
  return {
    firstName: true,
    lastName: true,
    email: true,
    person: {
      where: { tenantId },
      select: {
        firstName: true,
        lastName: true,
        displayName: true,
      },
    },
  } as const;
}

function isWaitingListStatus(value: unknown): value is WaitingListStatus {
  return typeof value === "string";
}

function mapAuditLog(entry: {
  id: string;
  action: string;
  afterJson: unknown;
  createdAt: Date;
  actorUser: AuditActorRecord;
}): WaitingListTimelineEntry | null {
  const after = (entry.afterJson ?? {}) as Record<string, unknown>;
  const actor = actorName(entry.actorUser);
  const occurredAt = entry.createdAt.toISOString();

  switch (entry.action) {
    case "WAITING_LIST_CREATED":
      return {
        id: entry.id,
        label: "Auf Warteliste gesetzt",
        actorName: actor,
        occurredAt,
      };

    case "WAITING_LIST_STATUS_CHANGE": {
      const status = isWaitingListStatus(after.status) ? after.status : null;
      if (status === "CONTACTED") {
        return { id: entry.id, label: "Kontaktiert", actorName: actor, occurredAt };
      }
      if (status === "OFFERED") {
        return { id: entry.id, label: "Angebot gemacht", actorName: actor, occurredAt };
      }
      if (status && TERMINAL_STATUSES.includes(status)) {
        return {
          id: entry.id,
          label: `Abgeschlossen: ${WAITING_LIST_STATUS_LABELS[status]}`,
          actorName: actor,
          occurredAt,
        };
      }
      return null;
    }

    case "WAITING_LIST_PLACED":
      return {
        id: entry.id,
        label: `Abgeschlossen: ${WAITING_LIST_STATUS_LABELS.PLACED}`,
        actorName: actor,
        occurredAt,
      };

    case "INTERNAL_COMMENT_CREATED":
      return {
        id: entry.id,
        label: "Interner Kommentar erstellt",
        actorName: actor,
        occurredAt,
      };

    case "INTERNAL_COMMENT_UPDATED":
      return {
        id: entry.id,
        label: "Interner Kommentar bearbeitet",
        actorName: actor,
        occurredAt,
      };

    case "INTERNAL_COMMENT_DELETED":
      return {
        id: entry.id,
        label: "Interner Kommentar gelöscht",
        actorName: actor,
        occurredAt,
      };

    default:
      return null;
  }
}

type LegacyEntryInput = {
  id: string;
  addedAt: Date;
  lastContactedAt: Date | null;
  offeredAt: Date | null;
  resolvedAt: Date | null;
  status: WaitingListStatus;
  addedByUser: AuditActorRecord;
  resolvedByUser: AuditActorRecord;
};

function legacyFallbackEntries(
  entry: LegacyEntryInput,
  coveredKeys: Set<string>,
): WaitingListTimelineEntry[] {
  const items: WaitingListTimelineEntry[] = [];

  if (!coveredKeys.has("added")) {
    items.push({
      id: `${entry.id}-added`,
      label: "Auf Warteliste gesetzt",
      actorName: actorName(entry.addedByUser),
      occurredAt: entry.addedAt.toISOString(),
    });
  }

  if (entry.lastContactedAt && !coveredKeys.has("contacted")) {
    items.push({
      id: `${entry.id}-contacted`,
      label: "Kontaktiert",
      actorName: null,
      occurredAt: entry.lastContactedAt.toISOString(),
    });
  }

  if (entry.offeredAt && !coveredKeys.has("offered")) {
    items.push({
      id: `${entry.id}-offered`,
      label: "Angebot gemacht",
      actorName: null,
      occurredAt: entry.offeredAt.toISOString(),
    });
  }

  if (entry.resolvedAt && !coveredKeys.has("resolved")) {
    items.push({
      id: `${entry.id}-resolved`,
      label: `Abgeschlossen: ${WAITING_LIST_STATUS_LABELS[entry.status]}`,
      actorName: actorName(entry.resolvedByUser),
      occurredAt: entry.resolvedAt.toISOString(),
    });
  }

  return items;
}

function coverageKey(entry: WaitingListTimelineEntry): string | null {
  if (entry.label === "Auf Warteliste gesetzt") return "added";
  if (entry.label === "Kontaktiert") return "contacted";
  if (entry.label === "Angebot gemacht") return "offered";
  if (entry.label.startsWith("Abgeschlossen:")) return "resolved";
  return null;
}

/**
 * Builds the waiting-list timeline for one entry, oldest first.
 */
export async function getWaitingListTimeline(
  tenantSlug: string,
  entryId: string,
): Promise<WaitingListTimelineEntry[]> {
  const tenant = await requireTenant(tenantSlug);

  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, tenantId: tenant.id },
    select: {
      id: true,
      addedAt: true,
      lastContactedAt: true,
      offeredAt: true,
      resolvedAt: true,
      status: true,
      addedByUser: { select: auditActorSelect(tenant.id) },
      resolvedByUser: { select: auditActorSelect(tenant.id) },
    },
  });

  if (!entry) return [];

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "WaitingListEntry", entityId: entry.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      action: true,
      afterJson: true,
      createdAt: true,
      actorUser: { select: auditActorSelect(tenant.id) },
    },
  });

  const fromAudit = logs
    .map(mapAuditLog)
    .filter((item): item is WaitingListTimelineEntry => item !== null);

  const coveredKeys = new Set(
    fromAudit.map(coverageKey).filter((key): key is string => key !== null),
  );

  const legacy = legacyFallbackEntries(entry, coveredKeys);
  const combined = [...fromAudit, ...legacy];

  return combined.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}
