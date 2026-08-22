import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  threadFindFirst: vi.fn(),
  messageFindFirst: vi.fn(),
  messageCreate: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    communicationThread: { findFirst: mocks.threadFindFirst },
    communicationMessage: {
      findFirst: mocks.messageFindFirst,
      create: mocks.messageCreate,
    },
  },
}));

vi.mock("@/lib/communication/audit-integration", () => ({
  recordCommunicationAuditEvent: mocks.recordAudit,
}));

import { persistInboundEmailReply } from "@/lib/communication/inbound-email-service";

const TENANT_A = "tenant-a";
const THREAD_A = "thread-a";
const TOKEN_A = "a".repeat(64);

function thread() {
  return {
    id: THREAD_A,
    tenantId: TENANT_A,
    targetType: "REGISTRATION",
    targetId: "reg-a",
    inboundReplyToken: TOKEN_A,
    createdByUserId: null,
    createdAt: new Date("2026-08-21T10:00:00.000Z"),
    updatedAt: new Date("2026-08-21T10:00:00.000Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.threadFindFirst.mockResolvedValue(thread());
  mocks.messageFindFirst.mockResolvedValue(null);
  mocks.messageCreate.mockResolvedValue({ id: "msg-in-1" });
  mocks.recordAudit.mockResolvedValue(undefined);
});

describe("COMM-02 inbound email persistence", () => {
  it("accepts a valid inbound reply and persists it tenant-safely", async () => {
    const result = await persistInboundEmailReply({
      provider: "resend",
      providerEventId: "evt-1",
      providerMessageId: "email-1",
      fromAddress: "customer@example.com",
      toAddresses: [`reply+${TOKEN_A}@inbound.example.com`],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: "Danke!",
      bodyHtml: null,
      messageIdHeader: "<m1@example.com>",
      inReplyTo: "<m0@example.com>",
      references: ["<m0@example.com>"],
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: null,
    });

    expect(result).toMatchObject({ ok: true, kind: "PERSISTED", tenantId: TENANT_A, threadId: THREAD_A });
    expect(mocks.threadFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { inboundReplyToken: TOKEN_A } }),
    );
    expect(mocks.messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_A,
          threadId: THREAD_A,
          direction: "INBOUND",
          status: "RECEIVED",
          provider: "resend",
          providerMessageId: "email-1",
        }),
      }),
    );
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A, kind: "EMAIL_RECEIVED" }),
    );
  });

  it("resolves legacy reply tokens via stored outbound replyToAddress after token rotation", async () => {
    // Simulate a token that no longer exists on the thread (rotated), but was used
    // in a previously sent outbound reply-to address.
    mocks.threadFindFirst.mockImplementation(async (args) => {
      const where = (args as { where?: Record<string, unknown> }).where ?? {};
      if ("inboundReplyToken" in where) return null;
      if (where.id === THREAD_A && where.tenantId === TENANT_A) return thread();
      return null;
    });
    mocks.messageFindFirst.mockImplementation(async (args) => {
      const where = (args as { where?: Record<string, unknown> }).where ?? {};
      // Thread resolution fallback lookup by replyToAddress prefix.
      if (where.replyToAddress) return { threadId: THREAD_A, tenantId: TENANT_A };
      // Idempotency lookup: no existing inbound message.
      return null;
    });

    const result = await persistInboundEmailReply({
      provider: "resend",
      providerEventId: "evt-1",
      providerMessageId: "email-legacy-1",
      fromAddress: "customer@example.com",
      toAddresses: [`reply+${TOKEN_A}@inbound.example.com`],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: "Danke!",
      bodyHtml: null,
      messageIdHeader: "<m1@example.com>",
      inReplyTo: "<m0@example.com>",
      references: ["<m0@example.com>"],
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: null,
    });

    expect(result).toMatchObject({ ok: true, kind: "PERSISTED", tenantId: TENANT_A, threadId: THREAD_A });
    expect(mocks.messageCreate).toHaveBeenCalled();
  });

  it("blocks cross-tenant idempotency conflicts safely", async () => {
    mocks.messageFindFirst.mockResolvedValue({ id: "msg-in-1", tenantId: "tenant-b", threadId: "thread-b" });

    const result = await persistInboundEmailReply({
      provider: "resend",
      providerEventId: "evt-1",
      providerMessageId: "email-1",
      fromAddress: "customer@example.com",
      toAddresses: [`reply+${TOKEN_A}@inbound.example.com`],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: "Danke!",
      bodyHtml: null,
      messageIdHeader: "<m1@example.com>",
      inReplyTo: "<m0@example.com>",
      references: ["<m0@example.com>"],
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: null,
    });

    expect(result).toMatchObject({ ok: true, kind: "IDEMPOTENCY_CONFLICT" });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("is idempotent on duplicate providerMessageId", async () => {
    mocks.messageFindFirst.mockResolvedValue({ id: "msg-in-1", tenantId: TENANT_A, threadId: THREAD_A });

    const result = await persistInboundEmailReply({
      provider: "resend",
      providerEventId: "evt-1",
      providerMessageId: "email-1",
      fromAddress: "customer@example.com",
      toAddresses: [`reply+${TOKEN_A}@inbound.example.com`],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: "Danke!",
      bodyHtml: null,
      messageIdHeader: "<m1@example.com>",
      inReplyTo: "<m0@example.com>",
      references: ["<m0@example.com>"],
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: null,
    });

    expect(result).toMatchObject({ ok: true, kind: "DUPLICATE", messageId: "msg-in-1" });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("treats concurrent unique-constraint races as duplicates (safe replay)", async () => {
    mocks.messageFindFirst
      .mockResolvedValueOnce(null) // initial idempotency lookup
      .mockResolvedValueOnce({ id: "msg-in-1", tenantId: TENANT_A, threadId: THREAD_A }); // lookup after P2002
    mocks.messageCreate.mockRejectedValue({ code: "P2002" });

    const result = await persistInboundEmailReply({
      provider: "resend",
      providerEventId: "evt-1",
      providerMessageId: "email-1",
      fromAddress: "customer@example.com",
      toAddresses: [`reply+${TOKEN_A}@inbound.example.com`],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: "Danke!",
      bodyHtml: null,
      messageIdHeader: "<m1@example.com>",
      inReplyTo: "<m0@example.com>",
      references: ["<m0@example.com>"],
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: null,
    });

    expect(result).toMatchObject({ ok: true, kind: "DUPLICATE", messageId: "msg-in-1" });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("ignores unknown reply tokens safely", async () => {
    mocks.threadFindFirst.mockResolvedValue(null);

    const result = await persistInboundEmailReply({
      provider: "resend",
      providerEventId: "evt-1",
      providerMessageId: "email-1",
      fromAddress: "customer@example.com",
      toAddresses: [`reply+${TOKEN_A}@inbound.example.com`],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: "Danke!",
      bodyHtml: null,
      messageIdHeader: null,
      inReplyTo: null,
      references: null,
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: null,
    });

    expect(result).toMatchObject({ ok: true, kind: "UNKNOWN_TOKEN" });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("preserves HTML-only bodies for future improvements", async () => {
    const result = await persistInboundEmailReply({
      provider: "resend",
      providerEventId: "evt-1",
      providerMessageId: "email-2",
      fromAddress: "customer@example.com",
      toAddresses: [`reply+${TOKEN_A}@inbound.example.com`],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: null,
      bodyHtml: "<p>Nur HTML</p>",
      messageIdHeader: null,
      inReplyTo: null,
      references: null,
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: null,
    });

    expect(result).toMatchObject({ ok: true, kind: "PERSISTED" });
    expect(mocks.messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bodyText: null, bodyHtml: "<p>Nur HTML</p>" }),
      }),
    );
  });
});
