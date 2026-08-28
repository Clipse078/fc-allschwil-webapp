import { describe, expect, it } from "vitest";
import {
  formatTeamDocumentDate,
  formatTeamDocumentFileSize,
  formatTeamDocumentFileType,
} from "@/lib/teams/team-document-formatters";

describe("TEAM-COCKPIT-PREMIUM-01J-B — team document formatters", () => {
  it("H. formats common file types from MIME and filename", () => {
    expect(
      formatTeamDocumentFileType("application/pdf", "season-plan.pdf"),
    ).toBe("PDF");
    expect(
      formatTeamDocumentFileType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "notes.docx",
      ),
    ).toBe("DOCX");
    expect(
      formatTeamDocumentFileType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "stats.xlsx",
      ),
    ).toBe("XLSX");
    expect(formatTeamDocumentFileType("image/png", "photo.png")).toBe("PNG");
    expect(formatTeamDocumentFileType("text/csv", "export.csv")).toBe("CSV");
    expect(formatTeamDocumentFileType("application/zip", "archive.zip")).toBe(
      "ZIP",
    );
    expect(formatTeamDocumentFileType("video/mp4", "clip.mp4")).toBe("MP4");
  });

  it("does not expose raw MIME strings for office documents", () => {
    const label = formatTeamDocumentFileType(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "deck.pptx",
    );

    expect(label).toBe("PPTX");
    expect(label).not.toContain("application/vnd");
  });

  it("I. formats bytes, KB, and MB", () => {
    expect(formatTeamDocumentFileSize(512)).toBe("512 B");
    expect(formatTeamDocumentFileSize(824 * 1024)).toBe("824 KB");
    expect(formatTeamDocumentFileSize(Math.round(1.4 * 1024 * 1024))).toBe(
      "1.4 MB",
    );
    expect(formatTeamDocumentFileSize(42 * 1024 * 1024)).toBe("42.0 MB");
  });

  it("J. formats upload dates in de-CH style", () => {
    expect(
      formatTeamDocumentDate(new Date("2026-08-28T12:00:00.000Z")),
    ).toMatch(/28\.08\.2026/);
  });
});
