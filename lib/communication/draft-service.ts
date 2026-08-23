/**
 * Tenant-scoped persistence for reusable outbound communication drafts.
 *
 * Drafts are CommunicationMessage records. Attachments are linked by identity;
 * their immutable Blob-backed CommunicationAttachment records are never copied.
 */
import { prisma } from "@/lib/db/prisma";
import {
  MAX_EMAIL_BODY_LENGTH,
  MAX_EMAIL_SUBJECT_LENGTH,
} from "@/lib/communication/constants";
import { CommunicationServiceError, assertTenantId } from "@/lib/communication/errors";
import {
  getCommunicationMessageByIdForTenant,
  type CommunicationMessageRecord,
} from "@/lib/communication/message-service";
import { resolveCommunicationRecipientForTarget } from "@/lib/communication/recipient-resolver";
import { requireCommunicationThreadForTenant } from "@/lib/communication/thread-service";
import {
  CommunicationAttachmentServiceError,
  validateOutboundAttachmentSelection,
} from "@/lib/communication/attachment-service";
import { CommunicationAttachmentValidationError } from "@/lib/communication/attachment-validation";

export type SaveCommunicationDraftInput = {
  tenantId: string;
  threadId: string;
  actorUserId: string;
  subject: string;
  bodyText: string;
  attachmentIds?: string[];
};

export type UpdateCommunicationDraftInput = SaveCommunicationDraftInput & {
  draftId: string;
};

function normalizeDraftContent(input: SaveCommunicationDraftInput) {
  const actorUserId = input.actorUserId.trim();
  const subject = input.subject.trim();
  const bodyText = input.bodyText.trim();

  if (!actorUserId) {
    throw new CommunicationServiceError("SEND_FORBIDDEN", "Nicht authentifiziert.");
  }
  if (!subject || subject.length > MAX_EMAIL_SUBJECT_LENGTH) {
    throw new CommunicationServiceError("INVALID_INPUT", "Der Betreff ist ungültig.");
  }
  if (!bodyText || bodyText.length > MAX_EMAIL_BODY_LENGTH) {
    throw new CommunicationServiceError("INVALID_INPUT", "Die Nachricht ist ungültig.");
  }

  return { actorUserId, subject, bodyText };
}

function attachmentSelectionError(error: unknown): never {
  if (
    error instanceof CommunicationAttachmentServiceError ||
    error instanceof CommunicationAttachmentValidationError
  ) {
    throw new CommunicationServiceError("INVALID_INPUT", error.message);
  }
  throw error;
}

async function validateDraftContext(input: SaveCommunicationDraftInput) {
  const tenantId = assertTenantId(input.tenantId);
  const content = normalizeDraftContent(input);
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
      recipient.unavailableReason ?? "Für diesen Eintrag können keine Entwürfe gespeichert werden.",
    );
  }

  let attachmentIds: string[];
  try {
    attachmentIds = await validateOutboundAttachmentSelection({
      tenantId,
      actorUserId: content.actorUserId,
      attachmentIds: input.attachmentIds ?? [],
    });
  } catch (error) {
    attachmentSelectionError(error);
  }

  return { tenantId, thread, recipient, attachmentIds, ...content };
}

async function requirePersistedDraft(
  tenantId: string,
  draftId: string,
): Promise<CommunicationMessageRecord> {
  const draft = await getCommunicationMessageByIdForTenant(tenantId, draftId);
  if (!draft) {
    throw new CommunicationServiceError("MESSAGE_NOT_FOUND", "Entwurf nicht gefunden.");
  }
  return draft;
}

export async function getCommunicationDraftForThread(
  tenantIdInput: string,
  threadId: string,
): Promise<CommunicationMessageRecord | null> {
  const tenantId = assertTenantId(tenantIdInput);
  const thread = await requireCommunicationThreadForTenant(tenantId, threadId);
  const draft = await prisma.communicationMessage.findFirst({
    where: {
      tenantId,
      threadId: thread.id,
      direction: "OUTBOUND",
      channel: "EMAIL",
      status: "DRAFT",
    },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return draft ? getCommunicationMessageByIdForTenant(tenantId, draft.id) : null;
}

export async function createCommunicationDraft(
  input: SaveCommunicationDraftInput,
): Promise<CommunicationMessageRecord> {
  const context = await validateDraftContext(input);

  const created = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.communicationMessage.findFirst({
        where: {
          tenantId: context.tenantId,
          threadId: context.thread.id,
          direction: "OUTBOUND",
          channel: "EMAIL",
          status: "DRAFT",
        },
        select: { id: true },
      });
      if (existing) {
        throw new CommunicationServiceError(
          "INVALID_INPUT",
          "Für diesen Kommunikationsverlauf besteht bereits ein Entwurf.",
        );
      }

      const draft = await tx.communicationMessage.create({
        data: {
          tenantId: context.tenantId,
          threadId: context.thread.id,
          direction: "OUTBOUND",
          channel: "EMAIL",
          subject: context.subject,
          bodyText: context.bodyText,
          toAddresses: [context.recipient.email],
          status: "DRAFT",
          createdByUserId: context.actorUserId,
        },
        select: { id: true },
      });
      if (context.attachmentIds.length > 0) {
        await tx.communicationMessageAttachment.createMany({
          data: context.attachmentIds.map((attachmentId, sortOrder) => ({
            tenantId: context.tenantId,
            messageId: draft.id,
            attachmentId,
            sortOrder,
          })),
        });
      }
      return draft;
    },
    { isolationLevel: "Serializable" },
  );

  return requirePersistedDraft(context.tenantId, created.id);
}

export async function updateCommunicationDraft(
  input: UpdateCommunicationDraftInput,
): Promise<CommunicationMessageRecord> {
  const context = await validateDraftContext(input);
  const draftId = input.draftId.trim();
  if (!draftId) {
    throw new CommunicationServiceError("INVALID_INPUT", "draftId ist erforderlich.");
  }

  await prisma.$transaction(async (tx) => {
    const draft = await tx.communicationMessage.findFirst({
      where: {
        id: draftId,
        tenantId: context.tenantId,
        threadId: context.thread.id,
        direction: "OUTBOUND",
        channel: "EMAIL",
        status: "DRAFT",
      },
      select: { id: true },
    });
    if (!draft) {
      throw new CommunicationServiceError(
        "MESSAGE_NOT_FOUND",
        "Entwurf nicht gefunden oder gehört zu einem anderen Mandanten.",
      );
    }

    await tx.communicationMessage.update({
      where: { id: draft.id },
      data: {
        subject: context.subject,
        bodyText: context.bodyText,
        toAddresses: [context.recipient.email],
      },
    });
    await tx.communicationMessageAttachment.deleteMany({
      where: { tenantId: context.tenantId, messageId: draft.id },
    });
    if (context.attachmentIds.length > 0) {
      await tx.communicationMessageAttachment.createMany({
        data: context.attachmentIds.map((attachmentId, sortOrder) => ({
          tenantId: context.tenantId,
          messageId: draft.id,
          attachmentId,
          sortOrder,
        })),
      });
    }
  });

  return requirePersistedDraft(context.tenantId, draftId);
}
