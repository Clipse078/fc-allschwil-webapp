/**
 * COMM-01C: Auditable, tenant-scoped outbound email orchestration.
 */
import { MailConfigurationError, sendMail } from "@/lib/email/mailer";
import { prisma } from "@/lib/db/prisma";
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
import { requireCommunicationThreadForTenant } from "@/lib/communication/thread-service";

export type SendOutboundEmailInput = {
  tenantId: string;
  threadId: string;
  actorUserId: string;
  subject: string;
  bodyText: string;
};

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
  const thread = await requireCommunicationThreadForTenant(tenantId, input.threadId);
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
