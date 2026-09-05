import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  receivingGet: vi.fn(),
  resendConstructorArgs: [] as string[],
}));

vi.mock("resend", () => ({
  Resend: class ResendMock {
    emails = {
      receiving: {
        get: mocks.receivingGet,
      },
    };

    constructor(apiKey: string) {
      mocks.resendConstructorArgs.push(apiKey);
    }
  },
}));

import {
  normalizeResendEmailReceivedEvent,
  ResendInboundEmailFetchError,
} from "@/lib/communication/providers/resend/received-normalization";

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "email.received",
    created_at: "2026-08-21T11:00:00.000Z",
    data: {
      email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
      created_at: "2026-08-21T11:00:00.000Z",
      from: "customer@example.com",
      to: ["reply+token@gaupreniet.resend.app"],
      cc: [],
      bcc: [],
      subject: "Re: TEST3",
      message_id: "<m1@example.com>",
      attachments: [],
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resendConstructorArgs.length = 0;
  process.env.RESEND_API_KEY = "re_testkey";
  delete process.env.RESEND_RECEIVING_API_KEY;
  delete process.env.VERCEL_TARGET_ENV;
  delete process.env.ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS;
});

describe("normalizeResendEmailReceivedEvent (COMM-02B)", () => {
  it("calls Resend Receiving API using webhook email_id", async () => {
    mocks.receivingGet.mockResolvedValue({
      data: {
        object: "email",
        id: "56761188-7520-42d8-8898-ff6fc54ce618",
        to: ["reply+token@gaupreniet.resend.app"],
        from: "customer@example.com",
        created_at: "2026-08-21T11:00:01.000Z",
        subject: "Re: TEST3",
        bcc: [],
        cc: [],
        reply_to: [],
        received_for: ["reply+token@gaupreniet.resend.app"],
        html: "<p>Thanks</p>",
        text: "Thanks",
        headers: {
          from: "Customer <customer@example.com>",
          "in-reply-to": "<m0@example.com>",
          references: "<m0@example.com> <m1@example.com>",
        },
        message_id: "<m1@example.com>",
        attachments: [],
      },
      error: null,
    });

    const normalized = await normalizeResendEmailReceivedEvent({
      event: makeEvent(),
      providerEventId: "evt_123",
    });

    expect(mocks.receivingGet).toHaveBeenCalledWith("56761188-7520-42d8-8898-ff6fc54ce618");
    expect(normalized).toMatchObject({
      provider: "resend",
      providerEventId: "evt_123",
      providerMessageId: "56761188-7520-42d8-8898-ff6fc54ce618",
      toAddresses: ["reply+token@gaupreniet.resend.app"],
      subject: "Re: TEST3",
      bodyText: "Thanks",
      bodyHtml: "<p>Thanks</p>",
      messageIdHeader: "<m1@example.com>",
    });
  });

  it("prefers RESEND_RECEIVING_API_KEY when set", async () => {
    process.env.RESEND_RECEIVING_API_KEY = "re_receiving_only";
    mocks.receivingGet.mockResolvedValue({ data: null, error: { message: "Not Found", statusCode: 404, name: "not_found" } });

    await expect(
      normalizeResendEmailReceivedEvent({ event: makeEvent(), providerEventId: null }),
    ).rejects.toBeInstanceOf(ResendInboundEmailFetchError);

    expect(mocks.resendConstructorArgs[0]).toBe("re_receiving_only");
  });

  it("throws ResendInboundEmailFetchError with provider metadata on receiving.get failures", async () => {
    mocks.receivingGet.mockResolvedValue({
      data: null,
      error: { message: "Not Found", statusCode: 404, name: "not_found" },
    });

    await expect(
      normalizeResendEmailReceivedEvent({ event: makeEvent(), providerEventId: null }),
    ).rejects.toMatchObject({
      name: "ResendInboundEmailFetchError",
      emailId: "56761188-7520-42d8-8898-ff6fc54ce618",
      statusCode: 404,
      providerErrorName: "not_found",
    });
  });

  it("returns null for unsupported event types without calling Resend", async () => {
    const normalized = await normalizeResendEmailReceivedEvent({
      event: { type: "email.sent", data: {} },
      providerEventId: null,
    });

    expect(normalized).toBeNull();
    expect(mocks.receivingGet).not.toHaveBeenCalled();
  });

  it("throws when API key is missing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_RECEIVING_API_KEY;

    await expect(
      normalizeResendEmailReceivedEvent({ event: makeEvent(), providerEventId: null }),
    ).rejects.toMatchObject({
      name: "ResendInboundEmailFetchError",
      emailId: "56761188-7520-42d8-8898-ff6fc54ce618",
    });
    expect(mocks.receivingGet).not.toHaveBeenCalled();
  });

  it("does not fetch inbound email in Acceptance from copied credentials alone", async () => {
    process.env.VERCEL_TARGET_ENV = "acceptance";

    await expect(
      normalizeResendEmailReceivedEvent({
        event: makeEvent(),
        providerEventId: null,
      }),
    ).rejects.toBeInstanceOf(ResendInboundEmailFetchError);
    expect(mocks.receivingGet).not.toHaveBeenCalled();
  });
});

