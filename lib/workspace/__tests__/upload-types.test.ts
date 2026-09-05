import { describe, expect, it } from "vitest";

import {
  ALLOWED_WORKSPACE_MIME_TYPES,
  MAX_WORKSPACE_FILE_SIZE_BYTES,
  getWorkspaceAttachmentContentDisposition,
  isAllowedWorkspaceMimeType,
  sanitizeWorkspaceFilename,
  validateWorkspaceUploadFile,
} from "@/lib/workspace/upload-types";

function createTestFile(input: {
  name?: string;
  type?: string;
  content?: string;
} = {}): File {
  return new File(
    [input.content ?? "test"],
    input.name ?? "document.pdf",
    {
      type: input.type ?? "application/pdf",
    },
  );
}

describe("Workspace upload policy", () => {
  it("supports the required document MIME types", () => {
    expect(ALLOWED_WORKSPACE_MIME_TYPES).toContain(
      "application/pdf",
    );

    expect(ALLOWED_WORKSPACE_MIME_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(ALLOWED_WORKSPACE_MIME_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    expect(ALLOWED_WORKSPACE_MIME_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
  });

  it("recognizes allowed and forbidden MIME types", () => {
    expect(
      isAllowedWorkspaceMimeType("application/pdf"),
    ).toBe(true);

    expect(
      isAllowedWorkspaceMimeType("application/x-msdownload"),
    ).toBe(false);
  });

  it("sanitizes path traversal and invalid filename characters", () => {
    expect(
      sanitizeWorkspaceFilename(
        "../../Trainer: Handbuch?.pdf",
      ),
    ).toBe("Trainer- Handbuch-.pdf");

    expect(
      sanitizeWorkspaceFilename(
        String.raw`C:\temp\report.xlsx`,
      ),
    ).toBe("report.xlsx");
  });

  it("collapses whitespace and removes control characters", () => {
    expect(
      sanitizeWorkspaceFilename(
        "  Club\u0000   Dokument   2026.pdf  ",
      ),
    ).toBe("Club Dokument 2026.pdf");
  });

  it("uses a safe fallback filename", () => {
    expect(sanitizeWorkspaceFilename("...")).toBe("file");
    expect(sanitizeWorkspaceFilename("")).toBe("file");
  });

  it("builds attachment headers without trusting provider metadata", () => {
    expect(
      getWorkspaceAttachmentContentDisposition(
        '../"Privatäkte".pdf',
      ),
    ).toBe(
      `attachment; filename="-Privat_kte-.pdf"; filename*=UTF-8''-Privat%C3%A4kte-.pdf`,
    );
  });

  it("accepts a valid file", () => {
    const file = createTestFile({
      name: " Trainer: Handbuch.pdf ",
      type: "application/pdf",
      content: "content",
    });

    expect(validateWorkspaceUploadFile(file)).toEqual({
      ok: true,
      filename: "Trainer- Handbuch.pdf",
      mimeType: "application/pdf",
      sizeBytes: file.size,
    });
  });

  it("rejects a forbidden MIME type", () => {
    const file = createTestFile({
      name: "malware.exe",
      type: "application/x-msdownload",
    });

    expect(validateWorkspaceUploadFile(file)).toEqual({
      ok: false,
      error:
        "Nicht erlaubter Dateityp: application/x-msdownload.",
    });
  });

  it("rejects an empty file", () => {
    const file = createTestFile({
      content: "",
    });

    expect(validateWorkspaceUploadFile(file)).toEqual({
      ok: false,
      error: "Leere Dateien können nicht hochgeladen werden.",
    });
  });

  it("accepts a file exactly at the size limit", () => {
    const file = {
      name: "limit.pdf",
      type: "application/pdf",
      size: MAX_WORKSPACE_FILE_SIZE_BYTES,
    } as File;

    expect(validateWorkspaceUploadFile(file)).toEqual({
      ok: true,
      filename: "limit.pdf",
      mimeType: "application/pdf",
      sizeBytes: MAX_WORKSPACE_FILE_SIZE_BYTES,
    });
  });

  it("rejects a file above the size limit", () => {
    const file = {
      name: "large.pdf",
      type: "application/pdf",
      size: MAX_WORKSPACE_FILE_SIZE_BYTES + 1,
    } as File;

    const result = validateWorkspaceUploadFile(file);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("Datei zu gross");
      expect(result.error).toContain("Maximum: 100 MB");
    }
  });

  it("rejects an invalid file size", () => {
    const file = {
      name: "invalid.pdf",
      type: "application/pdf",
      size: -1,
    } as File;

    expect(validateWorkspaceUploadFile(file)).toEqual({
      ok: false,
      error: "Ungültige Dateigrösse.",
    });
  });
});