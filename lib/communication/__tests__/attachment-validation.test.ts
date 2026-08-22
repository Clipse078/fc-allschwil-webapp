import { describe, expect, it } from "vitest";
import {
  MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
  validateCommunicationAttachment,
  validateCommunicationAttachmentSet,
} from "@/lib/communication/attachment-validation";

const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

describe("communication attachment validation", () => {
  it("accepts a signature-matched PDF and sanitizes its filename", async () => {
    await expect(
      validateCommunicationAttachment({
        filename: "../Board: Minutes.pdf",
        declaredContentType: "application/pdf",
        buffer: pdf,
      }),
    ).resolves.toEqual({
      originalFilename: "../Board: Minutes.pdf",
      sanitizedFilename: "Board- Minutes.pdf",
      contentType: "application/pdf",
      sizeBytes: pdf.byteLength,
    });
  });

  it.each([
    ["payload.exe", "application/octet-stream"],
    ["payload.html", "text/html"],
    ["macro.docm", "application/vnd.ms-word.document.macroEnabled.12"],
    ["archive.zip", "application/zip"],
    ["vector.svg", "image/svg+xml"],
  ])("rejects blocked type %s", async (filename, declaredContentType) => {
    await expect(
      validateCommunicationAttachment({
        filename,
        declaredContentType,
        buffer: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toMatchObject({ code: "TYPE_NOT_ALLOWED" });
  });

  it("rejects MIME/content mismatches instead of trusting the client", async () => {
    await expect(
      validateCommunicationAttachment({
        filename: "report.pdf",
        declaredContentType: "application/pdf",
        buffer: new TextEncoder().encode("plain text"),
      }),
    ).rejects.toMatchObject({ code: "CONTENT_TYPE_MISMATCH" });
  });

  it("allows UTF-8 TXT but rejects HTML disguised as text", async () => {
    await expect(
      validateCommunicationAttachment({
        filename: "notes.txt",
        declaredContentType: "text/plain",
        buffer: new TextEncoder().encode("Safe notes"),
      }),
    ).resolves.toMatchObject({ contentType: "text/plain" });
    await expect(
      validateCommunicationAttachment({
        filename: "notes.txt",
        declaredContentType: "text/plain",
        buffer: new TextEncoder().encode("<script>alert(1)</script>"),
      }),
    ).rejects.toMatchObject({ code: "UNTRUSTED_TEXT_CONTENT" });
  });

  it("enforces individual, count and decoded-total limits", async () => {
    await expect(
      validateCommunicationAttachment({
        filename: "large.pdf",
        declaredContentType: "application/pdf",
        buffer: new Uint8Array(
          MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES + 1,
        ),
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });

    expect(() =>
      validateCommunicationAttachmentSet(
        Array.from({ length: 11 }, () => ({ sizeBytes: 1 })),
      ),
    ).toThrow(expect.objectContaining({ code: "TOO_MANY_ATTACHMENTS" }));
    expect(() =>
      validateCommunicationAttachmentSet([
        { sizeBytes: 10 * 1024 * 1024 },
        { sizeBytes: 10 * 1024 * 1024 + 1 },
      ]),
    ).toThrow(expect.objectContaining({ code: "TOTAL_SIZE_EXCEEDED" }));
  });
});
