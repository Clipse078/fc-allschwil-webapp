import { prisma } from "@/lib/db/prisma";
import { recordCommunicationAuditEvent } from "@/lib/communication/audit-integration";
import { CommunicationServiceError } from "@/lib/communication/errors";
import type { NormalizedInboundEmail } from "@/lib/communication/inbound-email-types";
import {
  extractInboundReplyTokenFromAddresses,
} from "@/lib/communication/reply-routing";
import { getCommunicationThreadByInboundToken } from "@/lib/communication/thread-service";

export type InboundEmailPersistResult =
  | { ok: true; kind: "PERSISTED"; messageId: string; threadId: string; tenantId: string }
  | { ok: true; kind: "DUPLICATE"; messageId: string; threadId: string; tenantId: string }
  | { ok: true; kind: "IDEMPOTENCY_CONFLICT" }
  | { ok: true; kind: "UNKNOWN_TOKEN" }
  | { ok: false; kind: "INVALID_INPUT"; error: string };

function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  return code === "P2002";
}

export async function persistInboundEmailReply(
  email: NormalizedInboundEmail,
): Promise<InboundEmailPersistResult> {
  if (!email.providerMessageId.trim()) {
    return { ok: false, kind: "INVALID_INPUT", error: "providerMessageId is required" };
  }
  if (!Array.isArray(email.toAddresses) || email.toAddresses.length === 0) {
    return { ok: false, kind: "INVALID_INPUT", error: "toAddresses is required" };
  }

  const token = extractInboundReplyTokenFromAddresses(email.toAddresses);
  if (!token) {
    return { ok: true, kind: "UNKNOWN_TOKEN" };
  }

  const thread = await getCommunicationThreadByInboundToken(token);
  if (!thread) {
    return { ok: true, kind: "UNKNOWN_TOKEN" };
  }

  const provider = email.provider.trim();
  if (!provider) {
    return { ok: false, kind: "INVALID_INPUT", error: "provider is required" };
  }

  // Idempotency by provider message id (stable across retries).
  const existing = await prisma.communicationMessage.findFirst({
    where: {
      provider,
      providerMessageId: email.providerMessageId.trim(),
    },
    select: { id: true, tenantId: true, threadId: true },
  });
  if (existing) {
    // Defensive: never leak cross-tenant linkage; resolved thread is authoritative.
    if (existing.tenantId !== thread.tenantId || existing.threadId !== thread.id) {
      console.error("Inbound email idempotency conflict ignored:", {
        provider,
        providerMessageId: email.providerMessageId.trim(),
      });
      return { ok: true, kind: "IDEMPOTENCY_CONFLICT" };
    }
    return {
      ok: true,
      kind: "DUPLICATE",
      messageId: existing.id,
      threadId: existing.threadId,
      tenantId: existing.tenantId,
    };
  }

  let created: { id: string };
  try {
    created = await prisma.communicationMessage.create({
      data: {
        tenantId: thread.tenantId,
        threadId: thread.id,
        direction: "INBOUND",
        channel: "EMAIL",
        subject: email.subject?.trim() || null,
        bodyText: email.bodyText ?? null,
        bodyHtml: email.bodyHtml ?? null,
        fromAddress: email.fromAddress ?? null,
        toAddresses: email.toAddresses,
        provider,
        providerEventId: email.providerEventId?.trim() || null,
        providerMessageId: email.providerMessageId.trim(),
        messageIdHeader: email.messageIdHeader ?? null,
        inReplyTo: email.inReplyTo ?? null,
        references: email.references ?? undefined,
        status: "RECEIVED",
        receivedAt: email.receivedAt,
        attachments: email.attachments ?? undefined,
        createdByUserId: null,
      },
      select: { id: true },
    });
  } catch (error) {
    // Race-safe idempotency: if two webhook deliveries arrive concurrently, the second
    // insert can hit the unique(provider, providerMessageId) constraint.
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const raced = await prisma.communicationMessage.findFirst({
      where: {
        provider,
        providerMessageId: email.providerMessageId.trim(),
      },
      select: { id: true, tenantId: true, threadId: true },
    });
    if (raced && raced.tenantId === thread.tenantId && raced.threadId === thread.id) {
      return {
        ok: true,
        kind: "DUPLICATE",
        messageId: raced.id,
        threadId: raced.threadId,
        tenantId: raced.tenantId,
      };
    }

    // Defensive: the unique constraint is global, so a conflict here must not result
    // in cross-tenant writes and should not trigger infinite provider retries.
    console.error("Inbound email unique-constraint conflict ignored:", {
      provider,
      providerMessageId: email.providerMessageId.trim(),
    });
    return { ok: true, kind: "IDEMPOTENCY_CONFLICT" };
  }

  await recordCommunicationAuditEvent({
    tenantId: thread.tenantId,
    actorUserId: null,
    kind: "EMAIL_RECEIVED",
    threadId: thread.id,
    targetType: thread.targetType,
    targetId: thread.targetId,
    entityId: created.id,
    summary: "E-Mail empfangen",
  });

  return {
    ok: true,
    kind: "PERSISTED",
    messageId: created.id,
    threadId: thread.id,
    tenantId: thread.tenantId,
  };
}
