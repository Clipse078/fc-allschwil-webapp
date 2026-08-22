import type { CommunicationAttachmentMetadata } from "@/lib/communication/attachment-metadata";

export type InboundEmailAttachment = CommunicationAttachmentMetadata;

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
