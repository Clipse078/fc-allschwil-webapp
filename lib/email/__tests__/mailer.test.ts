import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  MailConfigurationError,
  MailAttachmentPreflightError,
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

afterEach(() => {
  delete process.env.VERCEL_TARGET_ENV;
  delete process.env.ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS;
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

  it("passes Buffer content, filename, and MIME type to Resend", async () => {
    const content = Buffer.from("pdf-bytes");
    await sendMail({
      to: "recipient@example.com",
      subject: "Attachment",
      html: "<p>Attachment</p>",
      attachments: [
        {
          filename: "vertrag.pdf",
          contentType: "application/pdf",
          content,
        },
      ],
    });

    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: "vertrag.pdf",
            contentType: "application/pdf",
            content,
          },
        ],
      }),
      undefined,
    );
  });

  it("rejects a payload that would exceed Resend's encoded 40 MiB limit", async () => {
    await expect(
      sendMail({
        to: "recipient@example.com",
        subject: "Too large",
        html: "<p>Too large</p>",
        attachments: [
          {
            filename: "large.pdf",
            contentType: "application/pdf",
            content: Buffer.alloc(31 * 1024 * 1024),
          },
        ],
      }),
    ).rejects.toBeInstanceOf(MailAttachmentPreflightError);
    expect(mocks.emailsSend).not.toHaveBeenCalled();
  });

  it("does not send from Acceptance when copied credentials are not explicitly enabled", async () => {
    process.env.VERCEL_TARGET_ENV = "acceptance";

    await expect(
      sendMail({
        to: "recipient@example.com",
        subject: "Blocked",
        html: "<p>Blocked</p>",
      }),
    ).rejects.toBeInstanceOf(MailConfigurationError);
    expect(mocks.emailsSend).not.toHaveBeenCalled();
  });
});
