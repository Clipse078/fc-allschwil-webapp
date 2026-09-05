/**
 * Communication Context Resolver — Layer 2.5 of the Communication Foundation.
 *
 * Bridges between a DB entity and the variable context needed to render a template.
 * Given a moduleKey + entityId, returns a Record<string, string> that can be
 * passed to renderTemplate() for real-data preview or future delivery.
 *
 * This is a pure DB-to-variable-map function. No AI, no inference.
 * Unknown fields are omitted (template keeps them as {{key}}).
 *
 * Usage:
 *   const ctx = await resolveContext("meeting", meetingId);
 *   const preview = renderTemplate(template.bodyMarkdown, ctx);
 *
 * TODO: Phase B.3.3 — club/tenant context
 *   Add club-level variables (club.name, club.email) from a Tenant/Club config model
 *   once that model exists. For now, these must be passed manually.
 *
 * TODO: Phase B.3.3 — season context
 *   Auto-populate season.* from the current active season.
 *
 * TODO: Phase B.3.3 — recipient context
 *   When templates are sent, recipient.* is populated from the addressee record
 *   at delivery time (not in the resolver, which operates on source entities).
 */

import { prisma } from "@/lib/db/prisma";

type ContextMap = Record<string, string>;

function formatSwissDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatSwissTime(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(date));
}

async function resolveMeetingContext(entityId: string, tenantId: string): Promise<ContextMap> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: entityId, tenantId },
    select: { title: true, meetingDate: true, location: true, description: true, attendeeCount: true },
  });
  if (!meeting) return {};
  return {
    "meeting.title": meeting.title,
    "meeting.date": formatSwissDate(meeting.meetingDate),
    "meeting.time": formatSwissTime(meeting.meetingDate),
    "meeting.location": meeting.location ?? "",
    "meeting.description": meeting.description ?? "",
  };
}

async function resolveTargetContext(entityId: string, tenantId: string): Promise<ContextMap> {
  const target = await prisma.target.findFirst({
    where: { id: entityId, tenantId },
    select: { title: true, description: true, category: true, periodLabel: true, period: true },
  });
  if (!target) return {};
  const CATEGORY_LABELS: Record<string, string> = {
    SPORTLICHE_ENTWICKLUNG: "Sportliche Entwicklung",
    MITGLIEDERWACHSTUM: "Mitgliederwachstum",
    FINANZEN: "Finanzen & Infrastruktur",
    AUSBILDUNG: "Ausbildung",
    MEDIEN_SOZIALES: "Medien & Soziales",
    GOVERNANCE: "Governance",
  };
  return {
    "target.title": target.title,
    "target.category": CATEGORY_LABELS[target.category] ?? target.category,
    "target.period": target.periodLabel ?? target.period,
    "target.description": target.description ?? "",
  };
}

async function resolveInitiativeContext(entityId: string, tenantId: string): Promise<ContextMap> {
  const initiative = await prisma.initiative.findFirst({
    where: { id: entityId, tenantId },
    select: { title: true, summary: true, owner: true, status: true, progress: true, dueDate: true },
  });
  if (!initiative) return {};
  const STATUS_LABELS: Record<string, string> = {
    PLANNED: "Geplant", IN_PROGRESS: "In Arbeit", ON_TRACK: "On Track",
    ON_HOLD: "Pausiert", COMPLETED: "Abgeschlossen", CANCELLED: "Abgesagt",
  };
  return {
    "initiative.title": initiative.title,
    "initiative.owner": initiative.owner ?? "",
    "initiative.status": STATUS_LABELS[initiative.status] ?? initiative.status,
    "initiative.progress": initiative.progress != null ? `${initiative.progress}%` : "",
    "initiative.dueDate": formatSwissDate(initiative.dueDate),
    "initiative.summary": initiative.summary ?? "",
  };
}

/**
 * Resolve a variable context map from a DB entity.
 *
 * @param moduleKey — which module the entity belongs to ("meeting" | "target" | "initiative")
 * @param entityId  — the DB entity id
 * @returns Record<string, string> ready for renderTemplate()
 */
export async function resolveContext(
  moduleKey: string,
  entityId: string,
  tenantId: string,
): Promise<ContextMap> {
  switch (moduleKey) {
    case "meetings":
    case "meeting":
      return resolveMeetingContext(entityId, tenantId);
    case "targets":
    case "target":
      return resolveTargetContext(entityId, tenantId);
    case "initiatives":
    case "initiative":
      return resolveInitiativeContext(entityId, tenantId);
    default:
      return {};
  }
}
