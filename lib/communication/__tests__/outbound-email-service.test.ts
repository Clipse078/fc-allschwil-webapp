import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: { message: null as Record<string, unknown> | null },
  threadFindFirst: vi.fn(),
  registrationFindFirst: vi.fn(),
  waitingListEntryFindFirst: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdateMany: vi.fn(),
  messageFindFirst: vi.fn(),
  sendMail: vi.fn(),
  resolveSender: vi.fn(),
  recordAudit: vi.fn(),
  validateAttachments: vi.fn(),
  attachSelection: vi.fn(),
  loadAttachments: vi.fn(),
  updateDraft: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    communicationThread: { findFirst: mocks.threadFindFirst },
    registration: { findFirst: mocks.registrationFindFirst },
    waitingListEntry: { findFirst: mocks.waitingListEntryFindFirst },
    communicationMessage: {
      create: mocks.messageCreate,
      updateMany: mocks.messageUpdateMany,
      findFirst: mocks.messageFindFirst,
    },
  },
}));

vi.mock("@/lib/email/mailer", () => ({
  MailConfigurationError: class MailConfigurationError extends Error {},
  MailAttachmentPreflightError: class MailAttachmentPreflightError extends Error {},
  sendMail: mocks.sendMail,
}));

vi.mock("@/lib/communication/email-sender-service", () => ({
  resolveTenantEmailSender: mocks.resolveSender,
}));

vi.mock("@/lib/communication/audit-integration", () => ({
  recordCommunicationAuditEvent: mocks.recordAudit,
}));
vi.mock("@/lib/communication/attachment-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/communication/attachment-service")>()),
  validateOutboundAttachmentSelection: mocks.validateAttachments,
  attachSelectionToMessage: mocks.attachSelection,
  loadMessageAttachmentsForDelivery: mocks.loadAttachments,
  cloneMessageAttachmentsForRetry: vi.fn(),
}));
vi.mock("@/lib/communication/draft-service", () => ({
  updateCommunicationDraft: mocks.updateDraft,
}));

import {
  plainTextToSafeHtml,
  sendCommunicationDraftForThread,
  sendOutboundEmailForThread,
} from "@/lib/communication/outbound-email-service";
import { resolveCommunicationRecipientForTarget } from "@/lib/communication/recipient-resolver";

const TENANT_A = "tenant-a";
const THREAD_A = "thread-a";
const ACTOR_A = "actor-a";
const STABLE_TOKEN = "a".repeat(48);
const INBOUND_DOMAIN = "inbound.example.com";

function thread(targetType: "REGISTRATION" | "WAITING_LIST_ENTRY", targetId: string) {
  return {
    id: THREAD_A,
    tenantId: TENANT_A,
    targetType,
    targetId,
    inboundReplyToken: STABLE_TOKEN,
    createdByUserId: ACTOR_A,
    createdAt: new Date("2026-08-21T10:00:00.000Z"),
    updatedAt: new Date("2026-08-21T10:00:00.000Z"),
  };
}

function registration(status = "NEW", email: string | null = "anna@example.com") {
  return {
    id: "reg-a",
    firstName: "Anna",
    lastName: "Muster",
    email,
    status,
  };
}

function waitingEntry(status = "ACTIVE", email: string | null = "wait@example.com") {
  return {
    id: "wait-a",
    status,
    registration: {
      firstName: "Wanda",
      lastName: "Wartend",
      email,
    },
  };
}

function storedMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "message-a",
    tenantId: TENANT_A,
    threadId: THREAD_A,
    direction: "OUTBOUND",
    channel: "EMAIL",
    subject: "Willkommen",
    bodyText: "Hallo Anna",
    bodyHtml: null,
    fromAddress: null,
    toAddresses: ["anna@example.com"],
    provider: "resend",
    providerMessageId: null,
    deliveryError: null,
    messageIdHeader: null,
    inReplyTo: null,
    references: null,
    status: "QUEUED",
    sentAt: null,
    receivedAt: null,
    createdByUserId: ACTOR_A,
    createdAt: new Date("2026-08-21T10:00:00.000Z"),
    updatedAt: new Date("2026-08-21T10:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMAIL_INBOUND_DOMAIN = INBOUND_DOMAIN;
  mocks.state.message = null;
  mocks.recordAudit.mockResolvedValue(undefined);
  mocks.validateAttachments.mockImplementation(
    async ({ attachmentIds }: { attachmentIds: string[] }) => attachmentIds,
  );
  mocks.attachSelection.mockResolvedValue([]);
  mocks.loadAttachments.mockResolvedValue([]);
  mocks.updateDraft.mockResolvedValue(storedMessage({ id: "draft-a", status: "DRAFT" }));
  mocks.resolveSender.mockResolvedValue({
    displayName: "FC Allschwil",
    emailAddress: "info@fcallschwil.ch",
    formattedFrom: "FC Allschwil <info@fcallschwil.ch>",
    source: "TENANT",
    providerStatus: "VERIFIED",
  });
  mocks.sendMail.mockResolvedValue({
    providerMessageId: "resend-message-1",
    from: "FC Allschwil <info@fcallschwil.ch>",
  });
  mocks.messageCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    mocks.state.message = storedMessage(data);
    return mocks.state.message;
  });
  mocks.messageUpdateMany.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => {
      mocks.state.message = { ...mocks.state.message, ...data, updatedAt: new Date() };
      return { count: 1 };
    },
  );
  mocks.messageFindFirst.mockImplementation(async () => mocks.state.message);
});

async function sendRegistration(status = "NEW", email: string | null = "anna@example.com") {
  mocks.threadFindFirst.mockResolvedValue(thread("REGISTRATION", "reg-a"));
  mocks.registrationFindFirst.mockResolvedValue(registration(status, email));
  return sendOutboundEmailForThread({
    tenantId: TENANT_A,
    threadId: THREAD_A,
    actorUserId: ACTOR_A,
    subject: " Willkommen ",
    bodyText: " Hallo Anna ",
  });
}

describe("COMM-01C tenant-safe recipient resolution", () => {
  it("C — cannot resolve a foreign tenant applicant recipient", async () => {
    mocks.registrationFindFirst.mockResolvedValue(null);

    await expect(
      resolveCommunicationRecipientForTarget({
        tenantId: TENANT_A,
        targetType: "REGISTRATION",
        targetId: "reg-tenant-b",
      }),
    ).rejects.toMatchObject({ code: "TARGET_NOT_FOUND" });
  });

  it("normalizes a tenant-owned registration recipient", async () => {
    mocks.registrationFindFirst.mockResolvedValue(registration("NEW", "  ANNA@Example.COM "));

    const recipient = await resolveCommunicationRecipientForTarget({
      tenantId: TENANT_A,
      targetType: "REGISTRATION",
      targetId: "reg-a",
    });

    expect(recipient).toMatchObject({
      email: "anna@example.com",
      displayName: "Anna Muster",
      available: true,
      sendAllowed: true,
    });
    expect(mocks.registrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "reg-a", tenantId: TENANT_A } }),
    );
  });
});

describe("COMM-01C outbound delivery", () => {
  it("B — Tenant A cannot send through Tenant B threadId", async () => {
    mocks.threadFindFirst.mockResolvedValue(null);

    await expect(
      sendOutboundEmailForThread({
        tenantId: TENANT_A,
        threadId: "thread-tenant-b",
        actorUserId: ACTOR_A,
        subject: "Nope",
        bodyText: "Nope",
      }),
    ).rejects.toMatchObject({ code: "THREAD_NOT_FOUND" });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("H/J/M — sends registration mail and persists provider id, SENT, actor and audit", async () => {
    const result = await sendRegistration();

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "anna@example.com",
        from: "FC Allschwil <info@fcallschwil.ch>",
        subject: "Willkommen",
        text: "Hallo Anna",
        html: "<p>Hallo Anna</p>",
        replyTo: `reply+${STABLE_TOKEN}@${INBOUND_DOMAIN}`,
        idempotencyKey: "message-a",
      }),
    );
    const sentPayload = vi.mocked(mocks.sendMail).mock.calls[0]?.[0];
    const replyTo = (sentPayload as { replyTo?: string }).replyTo ?? "";
    const localPart = replyTo.split("@")[0] ?? "";
    expect(localPart.length).toBeLessThanOrEqual(64);
    expect(mocks.messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        direction: "OUTBOUND",
        channel: "EMAIL",
        status: "QUEUED",
        replyToAddress: `reply+${STABLE_TOKEN}@${INBOUND_DOMAIN}`,
        createdByUserId: ACTOR_A,
      }),
    });
    expect(result).toMatchObject({
      status: "SENT",
      fromAddress: "FC Allschwil <info@fcallschwil.ch>",
      provider: "resend",
      providerMessageId: "resend-message-1",
      createdByUserId: ACTOR_A,
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        actorUserId: ACTOR_A,
        kind: "EMAIL_SENT",
        summary: "E-Mail gesendet",
      }),
    );
  });

  it("I — sends waiting-list mail through the linked registration recipient", async () => {
    mocks.threadFindFirst.mockResolvedValue(thread("WAITING_LIST_ENTRY", "wait-a"));
    mocks.waitingListEntryFindFirst.mockResolvedValue(waitingEntry());

    await sendOutboundEmailForThread({
      tenantId: TENANT_A,
      threadId: THREAD_A,
      actorUserId: ACTOR_A,
      subject: "Warteliste",
      bodyText: "Guten Tag",
    });

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "wait@example.com",
        from: "FC Allschwil <info@fcallschwil.ch>",
      }),
    );
    expect(mocks.waitingListEntryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_A,
          registration: { tenantId: TENANT_A },
        }),
      }),
    );
  });

  it("links selected attachments in order and sends their exact immutable bytes", async () => {
    const content = Buffer.from("immutable-pdf");
    mocks.threadFindFirst.mockResolvedValue(thread("REGISTRATION", "reg-a"));
    mocks.registrationFindFirst.mockResolvedValue(registration());
    mocks.loadAttachments.mockResolvedValue([
      {
        attachmentId: "attachment-a",
        filename: "vertrag.pdf",
        contentType: "application/pdf",
        sizeBytes: content.byteLength,
        content,
      },
    ]);

    await sendOutboundEmailForThread({
      tenantId: TENANT_A,
      threadId: THREAD_A,
      actorUserId: ACTOR_A,
      subject: "Vertrag",
      bodyText: "Im Anhang",
      attachmentIds: ["attachment-a"],
    });

    expect(mocks.validateAttachments).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      actorUserId: ACTOR_A,
      attachmentIds: ["attachment-a"],
    });
    expect(mocks.attachSelection).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      actorUserId: ACTOR_A,
      messageId: "message-a",
      attachmentIds: ["attachment-a"],
    });
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: "vertrag.pdf", contentType: "application/pdf", content }],
      }),
    );
  });

  it("K/L — provider failure persists FAILED and never emits false sent audit", async () => {
    mocks.sendMail.mockRejectedValue(new Error("provider secret detail"));

    await expect(sendRegistration()).rejects.toMatchObject({ code: "PROVIDER_FAILED" });

    expect(mocks.state.message).toMatchObject({
      status: "FAILED",
      deliveryError: "Der E-Mail-Dienst konnte die Nachricht nicht versenden.",
    });
    expect(JSON.stringify(mocks.state.message)).not.toContain("provider secret detail");
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "EMAIL_FAILED" }),
    );
    expect(mocks.recordAudit).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "EMAIL_SENT" }),
    );
  });

  it("keeps attachment associations on the failed historical message", async () => {
    mocks.threadFindFirst.mockResolvedValue(thread("REGISTRATION", "reg-a"));
    mocks.registrationFindFirst.mockResolvedValue(registration());
    mocks.sendMail.mockRejectedValue(new Error("provider rejected payload"));

    await expect(
      sendOutboundEmailForThread({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        actorUserId: ACTOR_A,
        subject: "Vertrag",
        bodyText: "Im Anhang",
        attachmentIds: ["attachment-a"],
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_FAILED" });

    expect(mocks.attachSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-a",
        attachmentIds: ["attachment-a"],
      }),
    );
    expect(mocks.state.message).toMatchObject({ id: "message-a", status: "FAILED" });
  });

  it("sends an existing draft through the normal provider lifecycle without creating a second message", async () => {
    mocks.threadFindFirst.mockResolvedValue(thread("REGISTRATION", "reg-a"));
    mocks.registrationFindFirst.mockResolvedValue(registration());
    mocks.state.message = storedMessage({ id: "draft-a", status: "DRAFT", provider: null });

    const result = await sendCommunicationDraftForThread({
      tenantId: TENANT_A,
      threadId: THREAD_A,
      draftId: "draft-a",
      actorUserId: ACTOR_A,
      subject: "Aktualisierter Entwurf",
      bodyText: "Bereit zum Senden",
      attachmentIds: ["attachment-a"],
    });

    expect(mocks.updateDraft).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      threadId: THREAD_A,
      draftId: "draft-a",
      actorUserId: ACTOR_A,
      subject: "Aktualisierter Entwurf",
      bodyText: "Bereit zum Senden",
      attachmentIds: ["attachment-a"],
    });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "draft-a",
        to: "anna@example.com",
        replyTo: `reply+${STABLE_TOKEN}@${INBOUND_DOMAIN}`,
      }),
    );
    expect(result).toMatchObject({
      id: "draft-a",
      status: "SENT",
      providerMessageId: "resend-message-1",
    });
  });

  it("turns a failed draft send into one historically accurate FAILED message", async () => {
    mocks.threadFindFirst.mockResolvedValue(thread("REGISTRATION", "reg-a"));
    mocks.registrationFindFirst.mockResolvedValue(registration());
    mocks.state.message = storedMessage({ id: "draft-a", status: "DRAFT", provider: null });
    mocks.sendMail.mockRejectedValue(new Error("provider detail"));

    await expect(
      sendCommunicationDraftForThread({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        draftId: "draft-a",
        actorUserId: ACTOR_A,
        subject: "Entwurf",
        bodyText: "Inhalt",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_FAILED" });

    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.state.message).toMatchObject({
      id: "draft-a",
      status: "FAILED",
      providerMessageId: null,
    });
  });

  it("O — missing or invalid recipient blocks provider delivery", async () => {
    await expect(sendRegistration("NEW", "not-an-email")).rejects.toMatchObject({
      code: "RECIPIENT_UNAVAILABLE",
    });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("P — terminal/archive registrations are read-only", async () => {
    await expect(sendRegistration("ARCHIVED")).rejects.toMatchObject({
      code: "SEND_FORBIDDEN",
    });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("Q — escapes HTML and enforces server-side content limits", async () => {
    expect(plainTextToSafeHtml(`<img src=x onerror="alert('x')">\nHello & bye`)).toBe(
      "<p>&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt;<br>Hello &amp; bye</p>",
    );

    mocks.threadFindFirst.mockResolvedValue(thread("REGISTRATION", "reg-a"));
    await expect(
      sendOutboundEmailForThread({
        tenantId: TENANT_A,
        threadId: THREAD_A,
        actorUserId: ACTOR_A,
        subject: "x".repeat(201),
        bodyText: "body",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(mocks.threadFindFirst).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
