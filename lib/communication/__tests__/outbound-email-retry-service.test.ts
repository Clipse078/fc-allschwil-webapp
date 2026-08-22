import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    messages: new Map<string, Record<string, unknown>>(),
  },
  threadFindFirst: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdateMany: vi.fn(),
  messageFindFirst: vi.fn(),
  sendMail: vi.fn(),
  resolveSender: vi.fn(),
  recordAudit: vi.fn(),
  getMessageByIdForTenant: vi.fn(),
  resolveRecipient: vi.fn(),
  cloneAttachments: vi.fn(),
  loadAttachments: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    communicationThread: { findFirst: mocks.threadFindFirst },
    communicationMessage: {
      create: mocks.messageCreate,
      updateMany: mocks.messageUpdateMany,
      findFirst: mocks.messageFindFirst,
    },
  },
}));

vi.mock("@/lib/email/mailer", () => ({
  MailConfigurationError: class MailConfigurationError extends Error {},
  sendMail: mocks.sendMail,
}));

vi.mock("@/lib/communication/email-sender-service", () => ({
  resolveTenantEmailSender: mocks.resolveSender,
}));

vi.mock("@/lib/communication/audit-integration", () => ({
  recordCommunicationAuditEvent: mocks.recordAudit,
}));

vi.mock("@/lib/communication/message-service", () => ({
  getCommunicationMessageByIdForTenant: mocks.getMessageByIdForTenant,
}));

vi.mock("@/lib/communication/recipient-resolver", () => ({
  resolveCommunicationRecipientForTarget: mocks.resolveRecipient,
}));
vi.mock("@/lib/communication/attachment-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/communication/attachment-service")>()),
  cloneMessageAttachmentsForRetry: mocks.cloneAttachments,
  loadMessageAttachmentsForDelivery: mocks.loadAttachments,
  validateOutboundAttachmentSelection: vi.fn(),
  attachSelectionToMessage: vi.fn(),
}));

import { retryFailedOutboundEmailForThread } from "@/lib/communication/outbound-email-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const THREAD_A = "thread-a";
const ACTOR_A = "actor-a";
const STABLE_TOKEN = "a".repeat(48);
const INBOUND_DOMAIN = "inbound.example.com";

function threadRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: THREAD_A,
    tenantId: TENANT_A,
    targetType: "REGISTRATION",
    targetId: "reg-a",
    inboundReplyToken: STABLE_TOKEN,
    createdByUserId: ACTOR_A,
    createdAt: new Date("2026-08-21T10:00:00.000Z"),
    updatedAt: new Date("2026-08-21T10:00:00.000Z"),
    ...overrides,
  };
}

function failedOutboundMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "message-failed-a",
    tenantId: TENANT_A,
    threadId: THREAD_A,
    direction: "OUTBOUND",
    channel: "EMAIL",
    subject: "TEST2",
    bodyText: "Hallo Anna",
    fromAddress: "SportClubEvo <noreply@mail.sportclubevo.com>",
    toAddresses: ["wrong@example.com"],
    provider: "resend",
    status: "FAILED",
    replyToAddress: `reply+${"b".repeat(64)}@${INBOUND_DOMAIN}`,
    deliveryError: "Der E-Mail-Dienst konnte die Nachricht nicht versenden.",
    sentAt: null,
    receivedAt: null,
    createdByUserId: ACTOR_A,
    createdAt: new Date("2026-08-21T10:00:00.000Z"),
    updatedAt: new Date("2026-08-21T10:00:00.000Z"),
    ...overrides,
  };
}

function storeMessage(value: Record<string, unknown>) {
  mocks.state.messages.set(String(value.id), value);
}

function getStoredMessage(id: string) {
  return mocks.state.messages.get(id) ?? null;
}

function isRetryId(id: string) {
  return String(id).startsWith("retry_");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.messages.clear();
  process.env.EMAIL_INBOUND_DOMAIN = INBOUND_DOMAIN;
  mocks.recordAudit.mockResolvedValue(undefined);
  mocks.cloneAttachments.mockResolvedValue([]);
  mocks.loadAttachments.mockResolvedValue([]);
  mocks.resolveSender.mockResolvedValue({
    displayName: "FC Allschwil",
    emailAddress: "info@fcallschwil.ch",
    formattedFrom: "FC Allschwil <info@fcallschwil.ch>",
    source: "TENANT",
    providerStatus: "VERIFIED",
  });
  mocks.resolveRecipient.mockResolvedValue({
    email: "correct@example.com",
    displayName: "Anna Muster",
    available: true,
    sendAllowed: true,
    unavailableReason: null,
  });
  mocks.sendMail.mockResolvedValue({
    providerMessageId: "resend-message-2",
    from: "FC Allschwil <info@fcallschwil.ch>",
  });

  mocks.threadFindFirst.mockResolvedValue(threadRecord());

  mocks.messageFindFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const id = typeof where.id === "string" ? where.id : null;
    if (id) {
      const candidate = getStoredMessage(id);
      if (!candidate) return null;
      if (typeof where.tenantId === "string" && candidate.tenantId !== where.tenantId) return null;
      if (typeof where.threadId === "string" && candidate.threadId !== where.threadId) return null;
      return candidate;
    }
    return null;
  });

  mocks.messageCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const message = {
      id: data.id,
      tenantId: data.tenantId,
      threadId: data.threadId,
      direction: data.direction,
      channel: data.channel,
      subject: data.subject,
      bodyText: data.bodyText,
      bodyHtml: null,
      fromAddress: null,
      toAddresses: data.toAddresses,
      provider: data.provider,
      providerEventId: null,
      providerMessageId: null,
      replyToAddress: data.replyToAddress ?? null,
      retryOfMessageId: data.retryOfMessageId ?? null,
      attachments: null,
      deliveryError: null,
      messageIdHeader: null,
      inReplyTo: null,
      references: null,
      status: data.status,
      sentAt: null,
      receivedAt: null,
      createdByUserId: data.createdByUserId ?? null,
      createdAt: new Date("2026-08-21T11:00:00.000Z"),
      updatedAt: new Date("2026-08-21T11:00:00.000Z"),
    };
    storeMessage(message);
    return message;
  });

  mocks.messageUpdateMany.mockImplementation(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const id = String(where.id);
    const existing = getStoredMessage(id);
    if (!existing) return { count: 0 };
    storeMessage({ ...existing, ...data, updatedAt: new Date() });
    return { count: 1 };
  });

  mocks.getMessageByIdForTenant.mockImplementation(async (tenantId: string, messageId: string) => {
    const message = getStoredMessage(messageId);
    if (!message) return null;
    return message.tenantId === tenantId ? message : null;
  });
});

describe("COMM-03A retry failed outbound email", () => {
  it("retries a FAILED outbound email by creating a new attempt and using current Reply-To generation", async () => {
    storeMessage(failedOutboundMessage());

    const result = await retryFailedOutboundEmailForThread({
      tenantId: TENANT_A,
      threadId: THREAD_A,
      actorUserId: ACTOR_A,
      sourceMessageId: "message-failed-a",
      idempotencyKey: "req-1",
    });

    expect(result.kind).toBe("CREATED");
    expect(isRetryId(result.message.id)).toBe(true);
    expect(result.message.id).not.toBe("message-failed-a");
    expect(result.message.status).toBe("SENT");
    expect(result.message.toAddresses).toEqual(["correct@example.com"]);
    expect(result.message.retryOfMessageId).toBe("message-failed-a");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "correct@example.com",
        from: "FC Allschwil <info@fcallschwil.ch>",
        subject: "TEST2",
        text: "Hallo Anna",
        replyTo: `reply+${STABLE_TOKEN}@${INBOUND_DOMAIN}`,
      }),
    );
    const sentPayload = vi.mocked(mocks.sendMail).mock.calls[0]?.[0] as { replyTo?: string; idempotencyKey?: string };
    expect(sentPayload.idempotencyKey).toBe(result.message.id);
    // Must not reuse a persisted legacy/invalid replyToAddress from the failed attempt.
    expect(sentPayload.replyTo).not.toContain("b".repeat(64));

    // Original failed record must remain unchanged.
    expect(getStoredMessage("message-failed-a")?.status).toBe("FAILED");
    expect(getStoredMessage("message-failed-a")?.fromAddress).toBe(
      "SportClubEvo <noreply@mail.sportclubevo.com>",
    );
    expect(getStoredMessage("message-failed-a")?.toAddresses).toEqual(["wrong@example.com"]);
    expect(result.message.fromAddress).toBe("FC Allschwil <info@fcallschwil.ch>");
    expect(
      mocks.messageUpdateMany.mock.calls.every(
        (call) => String(call[0]?.where?.id) !== "message-failed-a",
      ),
    ).toBe(true);
  });

  it("clones source associations and sends the same immutable attachment bytes", async () => {
    storeMessage(failedOutboundMessage());
    const content = Buffer.from("same immutable bytes");
    mocks.cloneAttachments.mockResolvedValue([
      { attachmentId: "attachment-a", sortOrder: 0 },
    ]);
    mocks.loadAttachments.mockResolvedValue([
      {
        attachmentId: "attachment-a",
        filename: "vertrag.pdf",
        contentType: "application/pdf",
        sizeBytes: content.byteLength,
        content,
      },
    ]);

    const result = await retryFailedOutboundEmailForThread({
      tenantId: TENANT_A,
      threadId: THREAD_A,
      actorUserId: ACTOR_A,
      sourceMessageId: "message-failed-a",
      idempotencyKey: "req-attachments",
    });

    expect(mocks.cloneAttachments).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      actorUserId: ACTOR_A,
      sourceMessageId: "message-failed-a",
      retryMessageId: result.message.id,
    });
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: "vertrag.pdf", contentType: "application/pdf", content }],
      }),
    );
    expect(getStoredMessage("message-failed-a")?.status).toBe("FAILED");
  });

  it("blocks retry when the current authoritative email is missing/invalid", async () => {
    storeMessage(failedOutboundMessage());
    mocks.resolveRecipient.mockResolvedValueOnce({
      email: null,
      displayName: "Anna Muster",
      available: false,
      sendAllowed: false,
      unavailableReason: "Für diese Person ist keine gültige E-Mail-Adresse verfügbar.",
    });

    await expect(
      retryFailedOutboundEmailForThread({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        actorUserId: ACTOR_A,
        sourceMessageId: "message-failed-a",
        idempotencyKey: "req-1",
      }),
    ).rejects.toMatchObject({ code: "RECIPIENT_UNAVAILABLE" });

    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("rejects retry when the source message is not FAILED", async () => {
    storeMessage(failedOutboundMessage({ status: "SENT" }));

    await expect(
      retryFailedOutboundEmailForThread({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        actorUserId: ACTOR_A,
        sourceMessageId: "message-failed-a",
        idempotencyKey: "req-1",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects retry when the source message is inbound", async () => {
    storeMessage(failedOutboundMessage({ direction: "INBOUND", status: "RECEIVED" }));

    await expect(
      retryFailedOutboundEmailForThread({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        actorUserId: ACTOR_A,
        sourceMessageId: "message-failed-a",
        idempotencyKey: "req-1",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("blocks cross-tenant retry by scoping lookup to tenantId + threadId", async () => {
    storeMessage(failedOutboundMessage({ tenantId: TENANT_B }));

    await expect(
      retryFailedOutboundEmailForThread({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        actorUserId: ACTOR_A,
        sourceMessageId: "message-failed-a",
        idempotencyKey: "req-1",
      }),
    ).rejects.toMatchObject({ code: "MESSAGE_NOT_FOUND" });
  });

  it("blocks retry when the message is in a different thread", async () => {
    storeMessage(failedOutboundMessage({ threadId: "thread-b" }));

    await expect(
      retryFailedOutboundEmailForThread({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        actorUserId: ACTOR_A,
        sourceMessageId: "message-failed-a",
        idempotencyKey: "req-1",
      }),
    ).rejects.toMatchObject({ code: "MESSAGE_NOT_FOUND" });
  });

  it("deduplicates repeated HTTP retries via Idempotency-Key without sending twice", async () => {
    storeMessage(failedOutboundMessage());

    const first = await retryFailedOutboundEmailForThread({
      tenantId: TENANT_A,
      threadId: THREAD_A,
      actorUserId: ACTOR_A,
      sourceMessageId: "message-failed-a",
      idempotencyKey: "req-1",
    });
    expect(first.kind).toBe("CREATED");
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);

    // Simulate the second request racing into the unique constraint on id.
    mocks.messageCreate.mockRejectedValueOnce({ code: "P2002" });
    const second = await retryFailedOutboundEmailForThread({
      tenantId: TENANT_A,
      threadId: THREAD_A,
      actorUserId: ACTOR_A,
      sourceMessageId: "message-failed-a",
      idempotencyKey: "req-1",
    });

    expect(second.kind).toBe("DUPLICATE");
    expect(second.message.id).toBe(first.message.id);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });
});

