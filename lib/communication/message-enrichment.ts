/**
 * COMM-01C: Safe public DTOs for the outbound email history.
 */
import { prisma } from "@/lib/db/prisma";
import { resolveAuditActorDisplayName } from "@/lib/registrations/actor-display";
import type { CommunicationMessageRecord } from "@/lib/communication/message-service";

export type PublicOutboundEmailMessage = {
  id: string;
  subject: string;
  body: string;
  recipient: string;
  status: "QUEUED" | "SENT" | "FAILED";
  senderDisplayName: string | null;
  sentAt: string | null;
  createdAt: string;
  deliveryError: string | null;
};

function firstRecipient(value: unknown): string {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
}

export async function toPublicOutboundEmailMessages(
  tenantId: string,
  messages: CommunicationMessageRecord[],
): Promise<PublicOutboundEmailMessage[]> {
  const outgoing = messages.filter(
    (message) => message.direction === "OUTBOUND" && message.channel === "EMAIL",
  );
  const userIds = [
    ...new Set(
      outgoing
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

  return outgoing.map((message) => ({
    id: message.id,
    subject: message.subject ?? "",
    body: message.bodyText ?? "",
    recipient: firstRecipient(message.toAddresses),
    status:
      message.status === "SENT" || message.status === "DELIVERED"
        ? "SENT"
        : message.status === "FAILED"
          ? "FAILED"
          : "QUEUED",
    senderDisplayName: message.createdByUserId
      ? (actorNames.get(message.createdByUserId) ?? null)
      : null,
    sentAt: message.sentAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    deliveryError: message.status === "FAILED" ? message.deliveryError : null,
  }));
}
