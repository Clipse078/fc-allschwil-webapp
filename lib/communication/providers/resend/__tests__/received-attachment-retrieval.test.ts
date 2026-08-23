import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachmentGet: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class ResendMock {
    emails = {
      receiving: {
        attachments: { get: mocks.attachmentGet },
      },
    };
  },
}));

import {
  createResendInboundAttachmentRetriever,
  ResendInboundAttachmentRetrievalError,
} from "@/lib/communication/providers/resend/received-attachment-retrieval";

const pdf = new TextEncoder().encode("%PDF-1.7\ninbound");
const metadata = {
  id: "attachment-a",
  filename: "Antwort.pdf",
  contentType: "application/pdf",
  contentDisposition: "attachment",
  contentId: null,
  size: pdf.byteLength,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Resend inbound attachment provider boundary", () => {
  it("retrieves signed provider content and returns normalized bytes without the URL", async () => {
    mocks.attachmentGet.mockResolvedValue({
      data: {
        object: "attachment",
        id: metadata.id,
        filename: metadata.filename,
        size: pdf.byteLength,
        content_type: metadata.contentType,
        content_disposition: "attachment",
        download_url: "https://attachments.example.test/signed",
        expires_at: "2026-08-23T08:00:00.000Z",
      },
      error: null,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(pdf, {
        headers: { "content-length": String(pdf.byteLength) },
      }),
    );

    const retrieve = createResendInboundAttachmentRetriever({
      emailId: "email-a",
      apiKey: "re_test",
      fetchImpl,
    });
    const result = await retrieve(metadata);

    expect(mocks.attachmentGet).toHaveBeenCalledWith({
      emailId: "email-a",
      id: "attachment-a",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://attachments.example.test/signed"),
      { redirect: "error" },
    );
    expect(result).toEqual({
      providerAttachmentId: "attachment-a",
      filename: "Antwort.pdf",
      contentType: "application/pdf",
      sizeBytes: pdf.byteLength,
      buffer: pdf,
    });
    expect(result).not.toHaveProperty("downloadUrl");
  });

  it("fails safely when dedicated metadata conflicts with the received email", async () => {
    mocks.attachmentGet.mockResolvedValue({
      data: {
        object: "attachment",
        id: metadata.id,
        filename: metadata.filename,
        size: pdf.byteLength + 1,
        content_type: metadata.contentType,
        content_disposition: "attachment",
        download_url: "https://attachments.example.test/signed",
        expires_at: "2026-08-23T08:00:00.000Z",
      },
      error: null,
    });

    const retrieve = createResendInboundAttachmentRetriever({
      emailId: "email-a",
      apiKey: "re_test",
      fetchImpl: vi.fn(),
    });
    await expect(retrieve(metadata)).rejects.toBeInstanceOf(
      ResendInboundAttachmentRetrievalError,
    );
  });

  it("rejects malformed metadata before making a provider request", async () => {
    const retrieve = createResendInboundAttachmentRetriever({
      emailId: "email-a",
      apiKey: "re_test",
      fetchImpl: vi.fn(),
    });
    await expect(
      retrieve({ ...metadata, contentType: null }),
    ).rejects.toBeInstanceOf(ResendInboundAttachmentRetrievalError);
    expect(mocks.attachmentGet).not.toHaveBeenCalled();
  });
});
