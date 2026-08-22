import { describe, expect, it } from "vitest";
import {
  readLegacyCommunicationAttachments,
  summarizeCommunicationAttachments,
} from "@/lib/communication/attachment-metadata";

describe("legacy communication attachment metadata compatibility", () => {
  it("keeps valid historical JSON readable and ignores malformed entries", () => {
    const legacy = readLegacyCommunicationAttachments([
      {
        id: "provider-a",
        filename: "invoice.pdf",
        contentType: "application/pdf",
        contentDisposition: "attachment",
        contentId: null,
        size: 123,
      },
      { filename: "missing-id.pdf" },
      "invalid",
    ]);
    expect(legacy).toEqual([
      {
        id: "provider-a",
        filename: "invoice.pdf",
        contentType: "application/pdf",
        contentDisposition: "attachment",
        contentId: null,
        size: 123,
      },
    ]);
  });

  it("coexists with ordered relational attachment details", () => {
    expect(
      summarizeCommunicationAttachments({
        legacyJson: [{ id: "legacy", filename: null }],
        relational: [
          {
            attachmentId: "b",
            filename: "b.pdf",
            contentType: "application/pdf",
            sizeBytes: 2,
            sortOrder: 1,
          },
          {
            attachmentId: "a",
            filename: "a.pdf",
            contentType: "application/pdf",
            sizeBytes: 1,
            sortOrder: 0,
          },
        ],
      }),
    ).toMatchObject({
      count: 3,
      relational: [{ attachmentId: "a" }, { attachmentId: "b" }],
    });
  });
});
