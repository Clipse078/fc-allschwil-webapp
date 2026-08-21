/**
 * lib/registrations/timeline.ts
 *
 * REGISTRATION-01F — Goal 5: simple chronological timeline.
 *
 * Built entirely from the existing AuditLog (moduleKey: "registrations",
 * entityType: "Registration") — no new event-log table. Every mutation the
 * PATCH endpoint and the person-creation/duplicate-ignore actions perform
 * already writes an AuditLog row (see route.ts / person-creation.ts), so
 * the timeline is always a faithful, append-only reconstruction of what
 * happened — ready for the future Communication module to plug its own
 * entries into the same feed (Goal 13).
 *
 * Newest first, per the spec ("Simple chronological list").
 */

import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { resolveAuditActorDisplayName } from "@/lib/registrations/actor-display";
import { STATUS_LABELS } from "@/lib/registrations/status";
import type { RegistrationStatus } from "@prisma/client";

export type TimelineEntryKind =
  | "RECEIVED"
  | "STATUS_CHANGE"
  | "CONTACTED"
  | "ARCHIVED"
  | "ASSIGNED_USER"
  | "ASSIGNED_TEAM"
  | "NO_RECOMMENDATION"
  | "PERSON_CREATED"
  | "PERSON_LINKED"
  | "PERSON_UNLINKED"
  | "DUPLICATE_IGNORED"
  | "WAITING_LIST_ADDED"
  | "EMAIL_SENT"
  | "EMAIL_FAILED"
  | "INTERNAL_COMMENT_CREATED"
  | "INTERNAL_COMMENT_UPDATED"
  | "INTERNAL_COMMENT_DELETED"
  | "OTHER";

export type TimelineEntry = {
  id: string;
  kind: TimelineEntryKind;
  label: string;
  detail: string | null;
  actorName: string | null;
  occurredAt: string;
};

function actorName(
  actor: {
    firstName: string;
    lastName: string;
    email: string;
    person: {
      firstName: string;
      lastName: string;
      displayName: string | null;
    } | null;
  } | null,
): string | null {
  return resolveAuditActorDisplayName(actor);
}

function isStatus(value: unknown): value is RegistrationStatus {
  return typeof value === "string";
}

function mapAuditEntry(entry: {
  id: string;
  action: string;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: Date;
  actorUser: {
    firstName: string;
    lastName: string;
    email: string;
    person: {
      firstName: string;
      lastName: string;
      displayName: string | null;
    } | null;
  } | null;
}): TimelineEntry {
  const before = (entry.beforeJson ?? {}) as Record<string, unknown>;
  const after = (entry.afterJson ?? {}) as Record<string, unknown>;
  const occurredAt = entry.createdAt.toISOString();
  const actor = actorName(entry.actorUser);

  switch (entry.action) {
    case "WEBSITE_SUBMISSION":
      return {
        id: entry.id,
        kind: "RECEIVED",
        label: "Registrierung eingegangen",
        detail: typeof after.source === "string" ? `Quelle: ${after.source}` : null,
        actorName: null,
        occurredAt,
      };

    case "STATUS_CHANGE": {
      const nextStatus = isStatus(after.status) ? after.status : null;
      if (nextStatus === "CONTACTED") {
        return { id: entry.id, kind: "CONTACTED", label: "Als kontaktiert markiert", detail: null, actorName: actor, occurredAt };
      }
      if (nextStatus === "ARCHIVED") {
        return { id: entry.id, kind: "ARCHIVED", label: "Archiviert", detail: null, actorName: actor, occurredAt };
      }
      const fromLabel = isStatus(before.status) ? STATUS_LABELS[before.status] : null;
      const toLabel = nextStatus ? STATUS_LABELS[nextStatus] : null;
      return {
        id: entry.id,
        kind: "STATUS_CHANGE",
        label: "Status geändert",
        detail: fromLabel && toLabel ? `${fromLabel} → ${toLabel}` : toLabel,
        actorName: actor,
        occurredAt,
      };
    }

    case "ASSIGNMENT_CHANGE": {
      const assigned = after.assignedToUserId;
      return {
        id: entry.id,
        kind: "ASSIGNED_USER",
        label: assigned ? "Zugewiesen" : "Zuweisung entfernt",
        detail: null,
        actorName: actor,
        occurredAt,
      };
    }

    case "TARGET_GROUP_CHANGE":
    case "ASSIGN_RECOMMENDED_TEAM":
    case "ASSIGN_ELSEWHERE": {
      const hasGroup = !!after.targetGroupId;
      return {
        id: entry.id,
        kind: "ASSIGNED_TEAM",
        label: hasGroup ? "Team zugewiesen" : "Team-Zuordnung entfernt",
        detail: typeof after.targetGroupName === "string" ? after.targetGroupName : null,
        actorName: actor,
        occurredAt,
      };
    }

    case "NO_RECOMMENDATION":
      return {
        id: entry.id,
        kind: "NO_RECOMMENDATION",
        label: "Keine Empfehlung — bewusst offen gelassen",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "PERSON_CREATED":
      return {
        id: entry.id,
        kind: "PERSON_CREATED",
        label: "Person erstellt",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "PERSON_LINKED":
      return {
        id: entry.id,
        kind: "PERSON_LINKED",
        label: "Mit bestehender Person verknüpft",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "PERSON_UNLINKED":
      return {
        id: entry.id,
        kind: "PERSON_UNLINKED",
        label: "Personenverknüpfung entfernt",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "DUPLICATE_IGNORED":
      return {
        id: entry.id,
        kind: "DUPLICATE_IGNORED",
        label: "Duplikatwarnung ignoriert",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "WAITING_LIST_CREATED":
      return {
        id: entry.id,
        kind: "WAITING_LIST_ADDED",
        label: "Auf Warteliste gesetzt",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "EMAIL_SENT":
      return {
        id: entry.id,
        kind: "EMAIL_SENT",
        label: "E-Mail gesendet",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "EMAIL_FAILED":
      return {
        id: entry.id,
        kind: "EMAIL_FAILED",
        label: "E-Mail-Versand fehlgeschlagen",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "INTERNAL_COMMENT_CREATED":
      return {
        id: entry.id,
        kind: "INTERNAL_COMMENT_CREATED",
        label: "Interner Kommentar erstellt",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "INTERNAL_COMMENT_UPDATED":
      return {
        id: entry.id,
        kind: "INTERNAL_COMMENT_UPDATED",
        label: "Interner Kommentar bearbeitet",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    case "INTERNAL_COMMENT_DELETED":
      return {
        id: entry.id,
        kind: "INTERNAL_COMMENT_DELETED",
        label: "Interner Kommentar gelöscht",
        detail: null,
        actorName: actor,
        occurredAt,
      };

    default:
      return {
        id: entry.id,
        kind: "OTHER",
        label: entry.action,
        detail: null,
        actorName: actor,
        occurredAt,
      };
  }
}

/**
 * Builds the full timeline for one registration, newest first.
 * Always includes a "Registrierung eingegangen" entry (from the audit log
 * when the submission wrote one, otherwise synthesized from submittedAt so
 * legacy/manual registrations still show a starting point).
 */
export async function getRegistrationTimeline(
  tenantSlug: string,
  registrationId: string,
): Promise<TimelineEntry[]> {
  const tenant = await requireTenant(tenantSlug);

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, tenantId: tenant.id },
    select: { id: true, submittedAt: true },
  });

  if (!registration) return [];

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "Registration",
      entityId: registration.id,
      // Legacy business events predate AuditLog.tenantId and are admitted only
      // after the tenant-owned registration above is resolved. Communication
      // events are never read without an explicit matching tenantId.
      OR: [
        { tenantId: tenant.id },
        {
          tenantId: null,
          action: { notIn: ["EMAIL_SENT", "EMAIL_FAILED", "EMAIL_DELIVERED", "EMAIL_RECEIVED"] },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      beforeJson: true,
      afterJson: true,
      createdAt: true,
      actorUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          person: {
            where: { tenantId: tenant.id },
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  const entries = logs.map(mapAuditEntry);

  const hasReceivedEntry = entries.some((e) => e.kind === "RECEIVED");
  if (!hasReceivedEntry) {
    entries.push({
      id: `${registration.id}-received`,
      kind: "RECEIVED",
      label: "Registrierung eingegangen",
      detail: null,
      actorName: null,
      occurredAt: registration.submittedAt.toISOString(),
    });
  }

  return entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}
