import type { CommunicationAttachmentMetadata } from "@/lib/communication/attachment-metadata";

export type InboundEmailAttachment = CommunicationAttachmentMetadata;

/**
 * Provider-independent bytes handed to the canonical attachment pipeline.
 * Temporary provider URLs never cross this boundary.
 */
export type RetrievedInboundEmailAttachment = {
  providerAttachmentId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  buffer: Uint8Array;
};

export type InboundEmailAttachmentRetriever = (
  attachment: InboundEmailAttachment,
) => Promise<RetrievedInboundEmailAttachment>;

export type NormalizedInboundEmail = {
  provider: string;
  providerEventId: string | null;
  providerMessageId: string;

  fromAddress: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];

  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;

  messageIdHeader: string | null;
  inReplyTo: string | null;
  references: string[] | null;

  receivedAt: Date;
  attachments: InboundEmailAttachment[] | null;
};
