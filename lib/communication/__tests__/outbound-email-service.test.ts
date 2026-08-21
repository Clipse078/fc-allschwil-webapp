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
  recordAudit: vi.fn(),
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
  sendMail: mocks.sendMail,
}));

vi.mock("@/lib/communication/audit-integration", () => ({
  recordCommunicationAuditEvent: mocks.recordAudit,
}));

import {
  plainTextToSafeHtml,
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
  mocks.sendMail.mockResolvedValue({
    providerMessageId: "resend-message-1",
    from: "SportClubEvo <noreply@mail.sportclubevo.com>",
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
      expect.objectContaining({ to: "wait@example.com" }),
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
