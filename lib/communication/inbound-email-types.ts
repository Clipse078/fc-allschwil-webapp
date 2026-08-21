export type InboundEmailAttachment = {
  id: string;
  filename: string | null;
  contentType: string | null;
  contentDisposition: string | null;
  contentId: string | null;
  size: number | null;
};

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

