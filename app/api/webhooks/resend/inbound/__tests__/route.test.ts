import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

const mocks = vi.hoisted(() => ({
  normalize: vi.fn(),
  persist: vi.fn(),
  processAttachments: vi.fn(),
  createRetriever: vi.fn(),
}));

vi.mock("@/lib/communication/providers/resend/received-normalization", () => ({
  normalizeResendEmailReceivedEvent: mocks.normalize,
  ResendInboundEmailFetchError: class ResendInboundEmailFetchError extends Error {},
}));

vi.mock("@/lib/communication/inbound-email-service", () => ({
  persistInboundEmailReply: mocks.persist,
}));
vi.mock("@/lib/communication/inbound-attachment-service", () => ({
  processInboundEmailAttachments: mocks.processAttachments,
}));
vi.mock("@/lib/communication/providers/resend/received-attachment-retrieval", () => ({
  createResendInboundAttachmentRetriever: mocks.createRetriever,
}));

const { POST } = await import("../route");

const SECRET = "whsec_" + Buffer.from("super-secret-key-123").toString("base64");

function signedRequest(payload: string) {
  const id = "msg_123";
  const timestamp = Math.floor(Date.now() / 1000);
  const wh = new Webhook(SECRET);
  const signature = wh.sign(id, new Date(timestamp * 1000), payload);

  return new Request("http://localhost/api/webhooks/resend/inbound", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(timestamp),
      "svix-signature": signature,
    },
    body: payload,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  mocks.normalize.mockResolvedValue(null);
  mocks.persist.mockResolvedValue({ ok: true, kind: "UNKNOWN_TOKEN" });
  mocks.processAttachments.mockResolvedValue({ processed: 1, failed: 0 });
  mocks.createRetriever.mockReturnValue(vi.fn());
});

describe("COMM-02 Resend inbound webhook", () => {
  it("rejects invalid signatures", async () => {
    const payload = JSON.stringify({ type: "email.received", data: { email_id: "email-1" } });
    const req = new Request("http://localhost/api/webhooks/resend/inbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": "msg_123",
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": "v1,invalid",
      },
      body: payload,
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 502 when provider retrieval fails (retryable)", async () => {
    const payload = JSON.stringify({
      type: "email.received",
      created_at: "2026-08-21T11:00:00.000Z",
      data: { email_id: "email-1" },
    });

    const { ResendInboundEmailFetchError } = await import(
      "@/lib/communication/providers/resend/received-normalization"
    );
    mocks.normalize.mockRejectedValue(
      new ResendInboundEmailFetchError({ message: "Resend down", emailId: "email-1" }),
    );

    const res = await POST(signedRequest(payload) as never);
    expect(res.status).toBe(502);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("accepts verified payloads and returns 200 on ignored/unknown tokens", async () => {
    const payload = JSON.stringify({
      type: "email.received",
      created_at: "2026-08-21T11:00:00.000Z",
      data: { email_id: "email-1" },
    });
    mocks.normalize.mockResolvedValue({
      provider: "resend",
      providerEventId: "msg_123",
      providerMessageId: "email-1",
      fromAddress: "customer@example.com",
      toAddresses: ["reply+token@inbound.example.com"],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: "Danke!",
      bodyHtml: null,
      messageIdHeader: "<m1@example.com>",
      inReplyTo: null,
      references: null,
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: null,
    });
    mocks.persist.mockResolvedValue({ ok: true, kind: "UNKNOWN_TOKEN" });

    const res = await POST(signedRequest(payload) as never);
    expect(res.status).toBe(200);
    expect(mocks.normalize).toHaveBeenCalled();
    expect(mocks.persist).toHaveBeenCalled();
  });

  it("processes attachments only for the newly persisted inbound message", async () => {
    const attachment = {
      id: "attachment-a",
      filename: "Antwort.pdf",
      contentType: "application/pdf",
      contentDisposition: "attachment",
      contentId: null,
      size: 20,
    };
    const normalized = {
      provider: "resend",
      providerEventId: "msg_123",
      providerMessageId: "email-1",
      fromAddress: "customer@example.com",
      toAddresses: ["reply+token@inbound.example.com"],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Re: Hallo",
      bodyText: "Mit Anhang",
      bodyHtml: null,
      messageIdHeader: "<m1@example.com>",
      inReplyTo: null,
      references: null,
      receivedAt: new Date("2026-08-21T11:00:00.000Z"),
      attachments: [attachment],
    };
    mocks.normalize.mockResolvedValue(normalized);
    mocks.persist.mockResolvedValue({
      ok: true,
      kind: "PERSISTED",
      messageId: "message-a",
      threadId: "thread-a",
      tenantId: "tenant-a",
    });
    const retrieve = vi.fn();
    mocks.createRetriever.mockReturnValue(retrieve);

    const res = await POST(
      signedRequest(JSON.stringify({ type: "email.received", data: { email_id: "email-1" } })) as never,
    );
    expect(res.status).toBe(200);
    expect(mocks.processAttachments).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      messageId: "message-a",
      provider: "resend",
      providerMessageId: "email-1",
      attachments: [attachment],
      retrieve,
    });

    mocks.persist.mockResolvedValue({
      ok: true,
      kind: "DUPLICATE",
      messageId: "message-a",
      threadId: "thread-a",
      tenantId: "tenant-a",
    });
    await POST(
      signedRequest(JSON.stringify({ type: "email.received", data: { email_id: "email-1" } })) as never,
    );
    expect(mocks.processAttachments).toHaveBeenCalledTimes(1);
  });
});
