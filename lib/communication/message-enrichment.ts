/**
 * COMM-02: Safe public DTOs for email thread history (inbound + outbound).
 */
import { prisma } from "@/lib/db/prisma";
import { resolveAuditActorDisplayName } from "@/lib/registrations/actor-display";
import type { CommunicationMessageRecord } from "@/lib/communication/message-service";

export type PublicEmailThreadMessage = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  subject: string;
  body: string;
  from: string | null;
  to: string | null;
  status: "QUEUED" | "SENT" | "FAILED" | "RECEIVED";
  senderDisplayName: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  deliveryError: string | null;
  attachmentCount: number;
};

function firstAddress(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") {
      const trimmed = first.trim();
      return trimmed ? trimmed : null;
    }
  }
  return null;
}

function htmlToPlainText(input: string): string {
  // Minimal, safe HTML→text fallback for display only (no fragile quoting logic).
  return input
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<\/p>/gi, "\n")
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll(/&nbsp;/g, " ")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&#039;/g, "'")
    .trim();
}

function safeEmailBodyForDisplay(message: CommunicationMessageRecord): string {
  if (typeof message.bodyText === "string" && message.bodyText.trim()) return message.bodyText;
  if (typeof message.bodyHtml === "string" && message.bodyHtml.trim()) return htmlToPlainText(message.bodyHtml);
  return "";
}

function attachmentCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function timelineTimestamp(message: CommunicationMessageRecord): Date {
  // Mirror the UI timeline timestamp selection to keep ordering intuitive and deterministic.
  // For outbound: prefer sentAt; for inbound: prefer receivedAt; fall back to createdAt.
  const preferred =
    message.direction === "INBOUND" ? message.receivedAt : message.sentAt;
  return preferred ?? message.createdAt;
}

export async function toPublicEmailThreadMessages(
  tenantId: string,
  messages: CommunicationMessageRecord[],
): Promise<PublicEmailThreadMessage[]> {
  const emailMessages = messages.filter((message) => message.channel === "EMAIL");
  const userIds = [
    ...new Set(
      emailMessages
        .map((message) => message.createdByUserId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            person: {
              where: { tenantId },
              select: { firstName: true, lastName: true, displayName: true },
            },
          },
        });
  const actorNames = new Map(
    users.map((user) => [user.id, resolveAuditActorDisplayName(user)]),
  );

  const sorted = [...emailMessages].sort((a, b) => {
    const tA = timelineTimestamp(a).getTime();
    const tB = timelineTimestamp(b).getTime();
    if (tA !== tB) return tA - tB;
    const cA = a.createdAt.getTime();
    const cB = b.createdAt.getTime();
    if (cA !== cB) return cA - cB;
    return a.id.localeCompare(b.id);
  });

  return sorted.map((message) => ({
    id: message.id,
    direction: message.direction,
    subject: message.subject ?? "",
    body: safeEmailBodyForDisplay(message),
    from: message.fromAddress ?? null,
    to: firstAddress(message.toAddresses),
    status:
      message.direction === "INBOUND"
        ? "RECEIVED"
        : message.status === "SENT" || message.status === "DELIVERED"
          ? "SENT"
          : message.status === "FAILED"
            ? "FAILED"
            : "QUEUED",
    senderDisplayName: message.createdByUserId
      ? (actorNames.get(message.createdByUserId) ?? null)
      : null,
    sentAt: message.sentAt?.toISOString() ?? null,
    receivedAt: message.receivedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    deliveryError: message.status === "FAILED" ? message.deliveryError : null,
    attachmentCount: attachmentCount(message.attachments),
  }));
}

export async function toPublicOutboundEmailMessages(
  tenantId: string,
  messages: CommunicationMessageRecord[],
): Promise<PublicEmailThreadMessage[]> {
  const mapped = await toPublicEmailThreadMessages(tenantId, messages);
  return mapped.filter((m) => m.direction === "OUTBOUND");
}
