import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ userFindMany: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findMany: mocks.userFindMany } },
}));

import { toPublicOutboundEmailMessages } from "@/lib/communication/message-enrichment";

beforeEach(() => vi.clearAllMocks());

describe("COMM-01C public email history", () => {
  it("returns actor and display fields without provider or internal tenant identifiers", async () => {
    mocks.userFindMany.mockResolvedValue([
      {
        id: "actor-a",
        firstName: "Club",
        lastName: "Admin",
        email: "admin@example.com",
        person: {
          firstName: "Michael",
          lastName: "Duijster",
          displayName: null,
        },
      },
    ]);

    const [result] = await toPublicOutboundEmailMessages("tenant-a", [
      {
        id: "message-a",
        tenantId: "tenant-a",
        threadId: "thread-a",
        direction: "OUTBOUND",
        channel: "EMAIL",
        subject: "Ein langer Betreff",
        bodyText: "Eine sichere Nachricht",
        bodyHtml: null,
        fromAddress: "private-sender@example.com",
        toAddresses: ["anna@example.com"],
        provider: "resend",
        providerEventId: null,
        providerMessageId: "provider-secret-id",
        replyToAddress: null,
        attachments: null,
        deliveryError: null,
        messageIdHeader: null,
        inReplyTo: null,
        references: null,
        status: "SENT",
        sentAt: new Date("2026-08-21T10:00:00.000Z"),
        receivedAt: null,
        createdByUserId: "actor-a",
        createdAt: new Date("2026-08-21T09:59:00.000Z"),
        updatedAt: new Date("2026-08-21T10:00:00.000Z"),
      },
    ]);

    expect(result).toMatchObject({
      direction: "OUTBOUND",
      senderDisplayName: "Michael Duijster",
      to: "anna@example.com",
      status: "SENT",
    });
    expect(result).not.toHaveProperty("tenantId");
    expect(result).not.toHaveProperty("threadId");
    expect(result).not.toHaveProperty("provider");
    expect(result).not.toHaveProperty("providerMessageId");
  });
});
