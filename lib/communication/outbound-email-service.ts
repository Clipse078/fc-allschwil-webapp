/**
 * COMM-01C: Auditable, tenant-scoped outbound email orchestration.
 */
import { MailConfigurationError, sendMail } from "@/lib/email/mailer";
import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";
import {
  MAX_EMAIL_BODY_LENGTH,
  MAX_EMAIL_SUBJECT_LENGTH,
} from "@/lib/communication/constants";
import { CommunicationServiceError, assertTenantId } from "@/lib/communication/errors";
import { recordCommunicationAuditEvent } from "@/lib/communication/audit-integration";
import {
  getCommunicationMessageByIdForTenant,
  type CommunicationMessageRecord,
} from "@/lib/communication/message-service";
import { resolveCommunicationRecipientForTarget } from "@/lib/communication/recipient-resolver";
import {
  ensureStableInboundReplyTokenForThread,
} from "@/lib/communication/thread-service";
import { buildInboundReplyToAddress } from "@/lib/communication/reply-routing";

export type SendOutboundEmailInput = {
  tenantId: string;
  threadId: string;
  actorUserId: string;
  subject: string;
  bodyText: string;
};

export type RetryFailedOutboundEmailInput = {
  tenantId: string;
  threadId: string;
  actorUserId: string;
  sourceMessageId: string;
  idempotencyKey: string;
};

export type RetryFailedOutboundEmailResult =
  | { kind: "CREATED"; message: CommunicationMessageRecord }
  | { kind: "DUPLICATE"; message: CommunicationMessageRecord };

export function plainTextToSafeHtml(value: string): string {
  const escaped = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  return `<p>${escaped.replaceAll(/\r?\n/g, "<br>")}</p>`;
}

function normalizeContent(input: SendOutboundEmailInput) {
  const subject = input.subject.trim();
  const bodyText = input.bodyText.trim();

  if (!subject) {
    throw new CommunicationServiceError("INVALID_INPUT", "Betreff ist erforderlich.");
  }
  if (subject.length > MAX_EMAIL_SUBJECT_LENGTH) {
    throw new CommunicationServiceError(
      "INVALID_INPUT",
      `Der Betreff darf höchstens ${MAX_EMAIL_SUBJECT_LENGTH} Zeichen enthalten.`,
    );
  }
  if (!bodyText) {
    throw new CommunicationServiceError("INVALID_INPUT", "Nachricht ist erforderlich.");
  }
  if (bodyText.length > MAX_EMAIL_BODY_LENGTH) {
    throw new CommunicationServiceError(
      "INVALID_INPUT",
      `Die Nachricht darf höchstens ${MAX_EMAIL_BODY_LENGTH} Zeichen enthalten.`,
    );
  }

  return { subject, bodyText };
}

function safeFailureSummary(error: unknown): string {
  return error instanceof MailConfigurationError
    ? "Der E-Mail-Versand ist derzeit nicht konfiguriert."
    : "Der E-Mail-Dienst konnte die Nachricht nicht versenden.";
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  return code === "P2002";
}

async function requireUpdatedMessage(
  tenantId: string,
  messageId: string,
): Promise<CommunicationMessageRecord> {
  const message = await getCommunicationMessageByIdForTenant(tenantId, messageId);
  if (!message) {
    throw new CommunicationServiceError("MESSAGE_NOT_FOUND", "E-Mail-Nachricht nicht gefunden.");
  }
  return message;
}

export async function sendOutboundEmailForThread(
  input: SendOutboundEmailInput,
): Promise<CommunicationMessageRecord> {
  const tenantId = assertTenantId(input.tenantId);
  const actorUserId = input.actorUserId.trim();
  if (!actorUserId) {
    throw new CommunicationServiceError("SEND_FORBIDDEN", "Nicht authentifiziert.");
  }

  const { subject, bodyText } = normalizeContent(input);
  // Ensure reply-token survives common email address normalization.
  const thread = await ensureStableInboundReplyTokenForThread(tenantId, input.threadId);
  const recipient = await resolveCommunicationRecipientForTarget({
    tenantId,
    targetType: thread.targetType,
    targetId: thread.targetId,
  });

  if (!recipient.available || !recipient.email) {
    throw new CommunicationServiceError(
      "RECIPIENT_UNAVAILABLE",
      recipient.unavailableReason ?? "Keine gültige E-Mail-Adresse verfügbar.",
    );
  }
  if (!recipient.sendAllowed) {
    throw new CommunicationServiceError(
      "SEND_FORBIDDEN",
      recipient.unavailableReason ?? "Für diesen Eintrag können keine E-Mails gesendet werden.",
    );
  }

  const replyToAddress = buildInboundReplyToAddress(thread.inboundReplyToken);

  const pending = await prisma.communicationMessage.create({
    data: {
      tenantId,
      threadId: thread.id,
      direction: "OUTBOUND",
      channel: "EMAIL",
      subject,
      bodyText,
      toAddresses: [recipient.email],
      provider: "resend",
      status: "QUEUED",
      replyToAddress,
      createdByUserId: actorUserId,
    },
  });

  let deliveryResult;
  try {
    deliveryResult = await sendMail({
      to: recipient.email,
      subject,
      text: bodyText,
      html: plainTextToSafeHtml(bodyText),
      replyTo: replyToAddress ?? undefined,
      idempotencyKey: pending.id,
    });
  } catch (error) {
    const deliveryError = safeFailureSummary(error);
    await prisma.communicationMessage.updateMany({
      where: { id: pending.id, tenantId, threadId: thread.id },
      data: { deliveryError, status: "FAILED" },
    });

    await recordCommunicationAuditEvent({
      tenantId,
      actorUserId,
      kind: "EMAIL_FAILED",
      threadId: thread.id,
      targetType: thread.targetType,
      targetId: thread.targetId,
      entityId: pending.id,
      summary: "E-Mail-Versand fehlgeschlagen",
    });

    throw new CommunicationServiceError(
      "PROVIDER_FAILED",
      "Die E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    );
  }

  const updated = await prisma.communicationMessage.updateMany({
    where: { id: pending.id, tenantId, threadId: thread.id },
    data: {
      fromAddress: deliveryResult.from,
      providerMessageId: deliveryResult.providerMessageId,
      deliveryError: null,
      status: "SENT",
      sentAt: new Date(),
    },
  });
  if (updated.count !== 1) {
    throw new CommunicationServiceError(
      "MESSAGE_NOT_FOUND",
      "Der Versand wurde angenommen, der Nachrichtenstatus konnte aber nicht aktualisiert werden.",
    );
  }

  await recordCommunicationAuditEvent({
    tenantId,
    actorUserId,
    kind: "EMAIL_SENT",
    threadId: thread.id,
    targetType: thread.targetType,
    targetId: thread.targetId,
    entityId: pending.id,
    summary: "E-Mail gesendet",
  });

  return requireUpdatedMessage(tenantId, pending.id);
}

function deriveRetryAttemptMessageId(sourceMessageId: string, idempotencyKey: string): string {
  const seed = `COMM-03A:${sourceMessageId.trim()}:${idempotencyKey.trim()}`;
  const digest = createHash("sha256").update(seed).digest("hex");
  return `retry_${digest.slice(0, 24)}`;
}

function firstRecipientAddress(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const first = value[0];
  return typeof first === "string" && first.trim() ? first.trim() : null;
}

export async function retryFailedOutboundEmailForThread(
  input: RetryFailedOutboundEmailInput,
): Promise<RetryFailedOutboundEmailResult> {
  const tenantId = assertTenantId(input.tenantId);
  const actorUserId = input.actorUserId.trim();
  if (!actorUserId) {
    throw new CommunicationServiceError("SEND_FORBIDDEN", "Nicht authentifiziert.");
  }

  const sourceMessageId = input.sourceMessageId.trim();
  if (!sourceMessageId) {
    throw new CommunicationServiceError("INVALID_INPUT", "messageId ist erforderlich.");
  }

  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new CommunicationServiceError(
      "INVALID_INPUT",
      "Idempotency-Key ist erforderlich.",
    );
  }

  // Ensure reply-token survives common email address normalization.
  const thread = await ensureStableInboundReplyTokenForThread(tenantId, input.threadId);
  const source = await prisma.communicationMessage.findFirst({
    where: { id: sourceMessageId, tenantId, threadId: thread.id },
    select: {
      id: true,
      direction: true,
      channel: true,
      status: true,
      subject: true,
      bodyText: true,
      toAddresses: true,
    },
  });
  if (!source) {
    throw new CommunicationServiceError("MESSAGE_NOT_FOUND", "E-Mail-Nachricht nicht gefunden.");
  }
  if (
    source.direction !== "OUTBOUND" ||
    source.channel !== "EMAIL" ||
    source.status !== "FAILED"
  ) {
    throw new CommunicationServiceError(
      "INVALID_INPUT",
      "Nur fehlgeschlagene ausgehende E-Mails können erneut gesendet werden.",
    );
  }

  const recipientEmail = firstRecipientAddress(source.toAddresses);
  const subject = source.subject?.trim() ?? "";
  const bodyText = source.bodyText?.trim() ?? "";
  if (!recipientEmail || !subject || !bodyText) {
    throw new CommunicationServiceError(
      "INVALID_INPUT",
      "Diese fehlgeschlagene E-Mail enthält nicht alle benötigten Versanddaten.",
    );
  }

  const replyToAddress = buildInboundReplyToAddress(thread.inboundReplyToken);
  const retryMessageId = deriveRetryAttemptMessageId(sourceMessageId, idempotencyKey);

  let pending: { id: string };
  try {
    pending = await prisma.communicationMessage.create({
      data: {
        id: retryMessageId,
        tenantId,
        threadId: thread.id,
        direction: "OUTBOUND",
        channel: "EMAIL",
        subject,
        bodyText,
        toAddresses: [recipientEmail],
        provider: "resend",
        status: "QUEUED",
        replyToAddress,
        createdByUserId: actorUserId,
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }
    const existing = await prisma.communicationMessage.findFirst({
      where: { id: retryMessageId },
      select: { id: true, tenantId: true, threadId: true },
    });
    if (existing && existing.tenantId === tenantId && existing.threadId === thread.id) {
      return { kind: "DUPLICATE", message: await requireUpdatedMessage(tenantId, existing.id) };
    }
    console.error("Outbound retry unique-constraint conflict ignored:", {
      retryMessageId,
    });
    throw new CommunicationServiceError(
      "TENANT_FORBIDDEN",
      "E-Mail-Nachricht nicht gefunden oder gehört zu einem anderen Mandanten.",
    );
  }

  let deliveryResult;
  try {
    deliveryResult = await sendMail({
      to: recipientEmail,
      subject,
      text: bodyText,
      html: plainTextToSafeHtml(bodyText),
      replyTo: replyToAddress ?? undefined,
      idempotencyKey: pending.id,
    });
  } catch (error) {
    const deliveryError = safeFailureSummary(error);
    await prisma.communicationMessage.updateMany({
      where: { id: pending.id, tenantId, threadId: thread.id },
      data: { deliveryError, status: "FAILED" },
    });

    await recordCommunicationAuditEvent({
      tenantId,
      actorUserId,
      kind: "EMAIL_FAILED",
      threadId: thread.id,
      targetType: thread.targetType,
      targetId: thread.targetId,
      entityId: pending.id,
      summary: "E-Mail-Versand fehlgeschlagen",
    });

    throw new CommunicationServiceError(
      "PROVIDER_FAILED",
      "Die E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    );
  }

  const updated = await prisma.communicationMessage.updateMany({
    where: { id: pending.id, tenantId, threadId: thread.id },
    data: {
      fromAddress: deliveryResult.from,
      providerMessageId: deliveryResult.providerMessageId,
      deliveryError: null,
      status: "SENT",
      sentAt: new Date(),
    },
  });
  if (updated.count !== 1) {
    throw new CommunicationServiceError(
      "MESSAGE_NOT_FOUND",
      "Der Versand wurde angenommen, der Nachrichtenstatus konnte aber nicht aktualisiert werden.",
    );
  }

  await recordCommunicationAuditEvent({
    tenantId,
    actorUserId,
    kind: "EMAIL_SENT",
    threadId: thread.id,
    targetType: thread.targetType,
    targetId: thread.targetId,
    entityId: pending.id,
    summary: "E-Mail gesendet",
  });

  return { kind: "CREATED", message: await requireUpdatedMessage(tenantId, pending.id) };
}
