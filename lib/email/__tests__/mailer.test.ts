import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  domainsList: vi.fn(),
  emailsSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    domains = { list: mocks.domainsList };
    emails = { send: mocks.emailsSend };
  },
}));

import {
  getSenderDomainAuthorization,
  sendMail,
} from "@/lib/email/mailer";

const PLATFORM_FROM = "SportClubEvo <noreply@mail.sportclubevo.com>";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = PLATFORM_FROM;
  mocks.emailsSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
  mocks.domainsList.mockResolvedValue({
    data: {
      object: "list",
      has_more: false,
      data: [{
        id: "domain-1",
        name: "fcallschwil.ch",
        status: "verified",
        capabilities: { sending: "enabled", receiving: "disabled" },
      }],
    },
    error: null,
  });
});

describe("Resend sender authorization", () => {
  it("authorizes only an exact verified sending domain", async () => {
    await expect(
      getSenderDomainAuthorization("info@fcallschwil.ch"),
    ).resolves.toBe("VERIFIED");
    await expect(
      getSenderDomainAuthorization("info@sub.fcallschwil.ch"),
    ).resolves.toBe("NOT_VERIFIED");
  });

  it("does not authorize provider errors or restricted credentials", async () => {
    mocks.domainsList.mockResolvedValue({
      data: null,
      error: { name: "restricted_api_key", message: "restricted" },
    });
    await expect(
      getSenderDomainAuthorization("info@fcallschwil.ch"),
    ).resolves.toBe("UNKNOWN");
  });

  it("never passes an unverified custom From to Resend", async () => {
    mocks.domainsList.mockResolvedValue({
      data: { object: "list", has_more: false, data: [] },
      error: null,
    });
    const result = await sendMail({
      from: "Unverified <mail@unverified.example>",
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: PLATFORM_FROM }),
      undefined,
    );
    expect(result.from).toBe(PLATFORM_FROM);
  });

  it("passes a verified tenant From while preserving Reply-To", async () => {
    const from = "FC Allschwil <info@fcallschwil.ch>";
    const replyTo = "reply+opaque-token@inbound.example.com";
    const result = await sendMail({
      from,
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      replyTo,
    });
    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ from, replyTo }),
      undefined,
    );
    expect(result.from).toBe(from);
  });
});
