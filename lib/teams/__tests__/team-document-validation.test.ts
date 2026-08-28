import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workspace/upload-types", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/workspace/upload-types")
  >();
  return {
    ...actual,
    MAX_WORKSPACE_FILE_SIZE_BYTES: 1024,
  };
});

import {
  validateTeamDocumentUpload,
} from "@/lib/teams/team-document-validation";
import { MAX_WORKSPACE_FILE_SIZE_BYTES } from "@/lib/workspace/upload-types";

const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("team document validation", () => {
  it("accepts a signature-matched PDF and sanitizes its filename", async () => {
    await expect(
      validateTeamDocumentUpload({
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

  it("accepts a valid PNG image", async () => {
    await expect(
      validateTeamDocumentUpload({
        filename: "photo.png",
        declaredContentType: "image/png",
        buffer: png,
      }),
    ).resolves.toMatchObject({
      contentType: "image/png",
      sanitizedFilename: "photo.png",
    });
  });

  it.each([
    ["payload.exe", "application/octet-stream"],
    ["payload.html", "text/html"],
    ["macro.docm", "application/vnd.ms-word.document.macroEnabled.12"],
    ["vector.svg", "image/svg+xml"],
  ])("rejects blocked type %s", async (filename, declaredContentType) => {
    await expect(
      validateTeamDocumentUpload({
        filename,
        declaredContentType,
        buffer: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toMatchObject({ code: "TYPE_NOT_ALLOWED" });
  });

  it("rejects MIME/content mismatches instead of trusting the client", async () => {
    await expect(
      validateTeamDocumentUpload({
        filename: "report.pdf",
        declaredContentType: "application/pdf",
        buffer: new TextEncoder().encode("plain text"),
      }),
    ).rejects.toMatchObject({ code: "CONTENT_TYPE_MISMATCH" });
  });

  it("enforces the workspace size limit", async () => {
    const oversized = new Uint8Array(MAX_WORKSPACE_FILE_SIZE_BYTES + 1);
    oversized.set(pdf);

    await expect(
      validateTeamDocumentUpload({
        filename: "large.pdf",
        declaredContentType: "application/pdf",
        buffer: oversized,
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("allows UTF-8 TXT but rejects HTML disguised as text", async () => {
    await expect(
      validateTeamDocumentUpload({
        filename: "notes.txt",
        declaredContentType: "text/plain",
        buffer: new TextEncoder().encode("Safe notes"),
      }),
    ).resolves.toMatchObject({ contentType: "text/plain" });
    await expect(
      validateTeamDocumentUpload({
        filename: "notes.txt",
        declaredContentType: "text/plain",
        buffer: new TextEncoder().encode("<script>alert(1)</script>"),
      }),
    ).rejects.toMatchObject({ code: "UNTRUSTED_TEXT_CONTENT" });
  });
});
