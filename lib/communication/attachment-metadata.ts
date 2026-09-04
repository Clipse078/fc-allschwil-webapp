/**
 * COMM-02: Normalized attachment metadata persisted as Prisma Json.
 * No binary payloads are stored here.
 */
export type CommunicationAttachmentMetadata = {
  id: string;
  filename: string | null;
  contentType: string | null;
  contentDisposition: string | null;
  contentId: string | null;
  size: number | null;
  processingStatus?: "PENDING" | "FAILED";
};

export type CommunicationAttachmentMetadataList = CommunicationAttachmentMetadata[];

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableSize(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

/**
 * Tolerant compatibility reader for historical JSON metadata. Invalid entries
 * are ignored; raw provider payloads and binary content are never exposed.
 */
export function readLegacyCommunicationAttachments(
  value: unknown,
): CommunicationAttachmentMetadataList {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id.trim()) return [];
    return [{
      id: item.id,
      filename: nullableString(item.filename),
      contentType: nullableString(item.contentType),
      contentDisposition: nullableString(item.contentDisposition),
      contentId: nullableString(item.contentId),
      size: nullableSize(item.size),
      processingStatus:
        item.processingStatus === "PENDING" || item.processingStatus === "FAILED"
          ? item.processingStatus
          : undefined,
    }];
  });
}

export function summarizeCommunicationAttachments(input: {
  legacyJson: unknown;
  relational?: ReadonlyArray<{
    attachmentId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    sortOrder: number;
  }>;
}) {
  const legacy = readLegacyCommunicationAttachments(input.legacyJson);
  const relational = [...(input.relational ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  return {
    count: legacy.length + relational.length,
    legacy,
    relational,
  };
}
