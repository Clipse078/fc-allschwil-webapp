import { describe, expect, it } from "vitest";

import {
  resolveWorkspaceFileType,
  type WorkspaceFileCategory,
} from "../file-type-util";

describe("resolveWorkspaceFileType – MIME type mapping", () => {
  it("resolves application/pdf to pdf category with preview", () => {
    const result = resolveWorkspaceFileType("application/pdf");
    expect(result.category).toBe("pdf");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves .docx MIME to word category without preview", () => {
    const result = resolveWorkspaceFileType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result.category).toBe("word");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves legacy .doc MIME to word category", () => {
    const result = resolveWorkspaceFileType("application/msword");
    expect(result.category).toBe("word");
  });

  it("resolves .xlsx MIME to excel category without preview", () => {
    const result = resolveWorkspaceFileType(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(result.category).toBe("excel");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves legacy .xls MIME to excel category", () => {
    const result = resolveWorkspaceFileType("application/vnd.ms-excel");
    expect(result.category).toBe("excel");
  });

  it("resolves .pptx MIME to powerpoint category without preview", () => {
    const result = resolveWorkspaceFileType(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(result.category).toBe("powerpoint");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves image/jpeg to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/jpeg");
    expect(result.category).toBe("image");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves image/png to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/png");
    expect(result.category).toBe("image");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves image/webp to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/webp");
    expect(result.category).toBe("image");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves image/gif to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/gif");
    expect(result.category).toBe("image");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves video/mp4 to video category without preview", () => {
    const result = resolveWorkspaceFileType("video/mp4");
    expect(result.category).toBe("video");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves application/zip to archive category without preview", () => {
    const result = resolveWorkspaceFileType("application/zip");
    expect(result.category).toBe("archive");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves text/plain to text category without preview", () => {
    const result = resolveWorkspaceFileType("text/plain");
    expect(result.category).toBe("text");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves text/csv to text category without preview", () => {
    const result = resolveWorkspaceFileType("text/csv");
    expect(result.category).toBe("text");
    expect(result.previewCapable).toBe(false);
  });

  it("handles unknown MIME type gracefully with unknown category", () => {
    const result = resolveWorkspaceFileType("application/x-unknown-format");
    expect(result.category).toBe("unknown");
    expect(result.previewCapable).toBe(false);
  });

  it("handles empty MIME type gracefully", () => {
    const result = resolveWorkspaceFileType("");
    expect(result.category).toBe("unknown");
    expect(result.previewCapable).toBe(false);
  });
});

describe("resolveWorkspaceFileType – wildcard prefix matching", () => {
  it("resolves unknown image/* MIME to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/avif");
    expect(result.category).toBe("image");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves unknown video/* MIME to video category without preview", () => {
    const result = resolveWorkspaceFileType("video/quicktime");
    expect(result.category).toBe("video");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves unknown audio/* MIME to audio category without preview", () => {
    const result = resolveWorkspaceFileType("audio/flac");
    expect(result.category).toBe("audio");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves unknown text/* MIME to text category without preview", () => {
    const result = resolveWorkspaceFileType("text/markdown");
    expect(result.category).toBe("text");
    expect(result.previewCapable).toBe(false);
  });
});

describe("resolveWorkspaceFileType – extension fallback", () => {
  it("falls back to .docx extension when MIME type is unrecognised", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "document.docx",
    );
    expect(result.category).toBe("word");
  });

  it("falls back to .pdf extension", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "report.pdf",
    );
    expect(result.category).toBe("pdf");
    expect(result.previewCapable).toBe(true);
  });

  it("falls back to .xlsx extension", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "Tabelle.xlsx",
    );
    expect(result.category).toBe("excel");
  });

  it("falls back to .zip extension", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "archive.zip",
    );
    expect(result.category).toBe("archive");
  });

  it("returns unknown when no extension matches", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "file.bin",
    );
    expect(result.category).toBe("unknown");
    expect(result.previewCapable).toBe(false);
  });

  it("returns unknown when filename has no extension", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "noextension",
    );
    expect(result.category).toBe("unknown");
  });

  it("handles extension case insensitively", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "Photo.JPG",
    );
    expect(result.category).toBe("image");
    expect(result.previewCapable).toBe(true);
  });
});

describe("resolveWorkspaceFileType – MIME takes priority over extension", () => {
  it("uses MIME type even when extension contradicts it", () => {
    const result = resolveWorkspaceFileType("application/pdf", "file.docx");
    expect(result.category).toBe("pdf");
    expect(result.previewCapable).toBe(true);
  });

  it("returns category that can be used as a translation key", () => {
    const validCategories: WorkspaceFileCategory[] = [
      "pdf", "word", "excel", "powerpoint", "image",
      "video", "audio", "archive", "text", "unknown",
    ];

    const mimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "image/png",
      "video/mp4",
      "audio/mpeg",
      "application/zip",
      "text/plain",
      "application/octet-stream",
    ];

    for (const mime of mimes) {
      const { category } = resolveWorkspaceFileType(mime);
      expect(validCategories).toContain(category);
    }
  });
});

describe("resolveWorkspaceFileType – returns stable category keys", () => {
  it("never returns a raw MIME string as the category", () => {
    const unknownMime = "application/x-custom-proprietary";
    const result = resolveWorkspaceFileType(unknownMime);
    expect(result.category).not.toBe(unknownMime);
    expect(result.category).toBe("unknown");
  });

  it("all returned categories are valid message keys", () => {
    const testCases: [string, WorkspaceFileCategory][] = [
      ["application/pdf", "pdf"],
      ["application/msword", "word"],
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "word"],
      ["application/vnd.ms-excel", "excel"],
      ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "excel"],
      ["application/vnd.ms-powerpoint", "powerpoint"],
      ["image/jpeg", "image"],
      ["video/mp4", "video"],
      ["audio/mpeg", "audio"],
      ["application/zip", "archive"],
      ["text/plain", "text"],
    ];

    for (const [mime, expectedCategory] of testCases) {
      const { category } = resolveWorkspaceFileType(mime);
      expect(category).toBe(expectedCategory);
    }
  });
});
