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
};

export type CommunicationAttachmentMetadataList = CommunicationAttachmentMetadata[];
