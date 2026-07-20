import { describe, expect, it } from "vitest";

import {
  getWorkspaceFileGermanLabel,
  resolveWorkspaceFileType,
} from "../file-type-util";

describe("resolveWorkspaceFileType – MIME type mapping", () => {
  it("resolves application/pdf to pdf category with correct label", () => {
    const result = resolveWorkspaceFileType("application/pdf");

    expect(result.category).toBe("pdf");
    expect(result.germanLabel).toBe("PDF-Dokument");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves .docx MIME to word category", () => {
    const result = resolveWorkspaceFileType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(result.category).toBe("word");
    expect(result.germanLabel).toBe("Word-Dokument");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves legacy .doc MIME to word category", () => {
    const result = resolveWorkspaceFileType("application/msword");

    expect(result.category).toBe("word");
    expect(result.germanLabel).toBe("Word-Dokument");
  });

  it("resolves .xlsx MIME to excel category", () => {
    const result = resolveWorkspaceFileType(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    expect(result.category).toBe("excel");
    expect(result.germanLabel).toBe("Excel-Arbeitsmappe");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves legacy .xls MIME to excel category", () => {
    const result = resolveWorkspaceFileType("application/vnd.ms-excel");

    expect(result.category).toBe("excel");
    expect(result.germanLabel).toBe("Excel-Arbeitsmappe");
  });

  it("resolves .pptx MIME to powerpoint category", () => {
    const result = resolveWorkspaceFileType(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    expect(result.category).toBe("powerpoint");
    expect(result.germanLabel).toBe("PowerPoint-Präsentation");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves image/jpeg to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/jpeg");

    expect(result.category).toBe("image");
    expect(result.germanLabel).toBe("JPEG-Bild");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves image/png to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/png");

    expect(result.category).toBe("image");
    expect(result.germanLabel).toBe("PNG-Bild");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves image/webp to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/webp");

    expect(result.category).toBe("image");
    expect(result.germanLabel).toBe("WebP-Bild");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves image/gif to image category with preview", () => {
    const result = resolveWorkspaceFileType("image/gif");

    expect(result.category).toBe("image");
    expect(result.germanLabel).toBe("GIF-Bild");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves video/mp4 to video category without preview", () => {
    const result = resolveWorkspaceFileType("video/mp4");

    expect(result.category).toBe("video");
    expect(result.germanLabel).toBe("Video");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves application/zip to archive category", () => {
    const result = resolveWorkspaceFileType("application/zip");

    expect(result.category).toBe("archive");
    expect(result.germanLabel).toBe("ZIP-Archiv");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves text/plain to text category", () => {
    const result = resolveWorkspaceFileType("text/plain");

    expect(result.category).toBe("text");
    expect(result.germanLabel).toBe("Textdokument");
  });

  it("resolves text/csv to text category with CSV label", () => {
    const result = resolveWorkspaceFileType("text/csv");

    expect(result.category).toBe("text");
    expect(result.germanLabel).toBe("CSV-Datei");
  });

  it("handles unknown MIME type gracefully", () => {
    const result = resolveWorkspaceFileType(
      "application/x-unknown-format",
    );

    expect(result.category).toBe("unknown");
    expect(result.germanLabel).toBe("Datei");
    expect(result.previewCapable).toBe(false);
  });

  it("handles empty MIME type gracefully", () => {
    const result = resolveWorkspaceFileType("");

    expect(result.category).toBe("unknown");
    expect(result.germanLabel).toBe("Datei");
  });
});

describe("resolveWorkspaceFileType – wildcard prefix matching", () => {
  it("resolves unknown image/* MIME to image category", () => {
    const result = resolveWorkspaceFileType("image/avif");

    expect(result.category).toBe("image");
    expect(result.previewCapable).toBe(true);
  });

  it("resolves unknown video/* MIME to video category", () => {
    const result = resolveWorkspaceFileType("video/quicktime");

    expect(result.category).toBe("video");
    expect(result.previewCapable).toBe(false);
  });

  it("resolves unknown audio/* MIME to audio category", () => {
    const result = resolveWorkspaceFileType("audio/flac");

    expect(result.category).toBe("audio");
    expect(result.previewCapable).toBe(false);
  });
});

describe("resolveWorkspaceFileType – extension fallback", () => {
  it("falls back to extension when MIME type is unknown", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "document.docx",
    );

    expect(result.category).toBe("word");
    expect(result.germanLabel).toBe("Word-Dokument");
  });

  it("uses extension fallback for .pdf filename", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "report.pdf",
    );

    expect(result.category).toBe("pdf");
    expect(result.previewCapable).toBe(true);
  });

  it("uses extension fallback for .xlsx filename", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "Tabelle.xlsx",
    );

    expect(result.category).toBe("excel");
  });

  it("uses extension fallback for .zip filename", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "archive.zip",
    );

    expect(result.category).toBe("archive");
    expect(result.germanLabel).toBe("ZIP-Archiv");
  });

  it("returns unknown when no extension matches", () => {
    const result = resolveWorkspaceFileType(
      "application/octet-stream",
      "file.bin",
    );

    expect(result.category).toBe("unknown");
    expect(result.germanLabel).toBe("Datei");
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
    expect(result.germanLabel).toBe("PDF-Dokument");
  });
});

describe("getWorkspaceFileGermanLabel", () => {
  it("returns the German label for a known MIME type", () => {
    expect(getWorkspaceFileGermanLabel("application/pdf")).toBe(
      "PDF-Dokument",
    );
  });

  it("returns the German label using extension fallback", () => {
    expect(
      getWorkspaceFileGermanLabel(
        "application/octet-stream",
        "photo.png",
      ),
    ).toBe("PNG-Bild");
  });

  it("returns generic label for unknown types", () => {
    expect(
      getWorkspaceFileGermanLabel("application/x-unknown"),
    ).toBe("Datei");
  });
});
