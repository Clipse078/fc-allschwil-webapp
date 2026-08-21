import { z } from "zod";
import { Resend } from "resend";
import type { NormalizedInboundEmail } from "@/lib/communication/inbound-email-types";

const attachmentSchema = z
  .object({
    id: z.string(),
    filename: z.string().nullable().optional(),
    content_type: z.string().nullable().optional(),
    content_disposition: z.string().nullable().optional(),
    content_id: z.string().nullable().optional(),
    size: z.number().int().nonnegative().nullable().optional(),
  })
  .passthrough();

const emailReceivedEventSchema = z
  .object({
    type: z.literal("email.received"),
    created_at: z.string().optional(),
    data: z.object({
      email_id: z.string(),
      created_at: z.string().optional(),
      from: z.string().optional(),
      to: z.array(z.string()).optional().default([]),
      cc: z.array(z.string()).optional().default([]),
      bcc: z.array(z.string()).optional().default([]),
      subject: z.string().nullable().optional(),
      message_id: z.string().nullable().optional(),
      attachments: z.array(attachmentSchema).optional().default([]),
    }),
  })
  .passthrough();

function normalizeHeaderToString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function parseReferences(value: string | null): string[] | null {
  if (!value) return null;
  // Message-IDs are typically space-separated.
  const parts = value
    .split(/\s+/g)
    .map((v) => v.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

export class ResendInboundEmailFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendInboundEmailFetchError";
  }
}

type ResendReceivedEmail = {
  id?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  from?: string;
  created_at?: string;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  message_id?: string | null;
  headers?: Record<string, unknown>;
  attachments?: Array<{
    id?: string;
    filename?: string | null;
    content_type?: string | null;
    content_disposition?: string | null;
    content_id?: string | null;
    size?: number | null;
  }>;
};

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export async function normalizeResendEmailReceivedEvent(args: {
  event: unknown;
  providerEventId: string | null;
}): Promise<NormalizedInboundEmail | null> {
  const parsed = emailReceivedEventSchema.safeParse(args.event);
  if (!parsed.success) {
    return null;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new ResendInboundEmailFetchError("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(apiKey);
  const emailId = parsed.data.data.email_id;

  const { data, error } = await resend.emails.receiving.get(emailId);
  if (error || !data) {
    const message = error?.message ? `Resend receiving.get failed: ${error.message}` : "Resend receiving.get failed.";
    throw new ResendInboundEmailFetchError(message);
  }

  const email = data as unknown as ResendReceivedEmail;
  const headers = email.headers ?? undefined;
  const fromAddress = normalizeHeaderToString(headers?.["from"]) ?? (typeof email.from === "string" ? email.from : null);
  const inReplyTo = normalizeHeaderToString(headers?.["in-reply-to"]);
  const references = parseReferences(normalizeHeaderToString(headers?.["references"]));

  const receivedAtRaw = typeof email.created_at === "string" ? email.created_at : null;
  const receivedAt = receivedAtRaw ? new Date(receivedAtRaw) : new Date();

  const attachments = Array.isArray(email.attachments)
    ? email.attachments
        .map((a) => ({
          id: typeof a?.id === "string" ? a.id : "",
          filename: typeof a?.filename === "string" ? a.filename : null,
          contentType: typeof a?.content_type === "string" ? a.content_type : null,
          contentDisposition: typeof a?.content_disposition === "string" ? a.content_disposition : null,
          contentId: typeof a?.content_id === "string" ? a.content_id : null,
          size: typeof a?.size === "number" ? a.size : null,
        }))
        .filter((a) => Boolean(a.id))
    : null;

  return {
    provider: "resend",
    providerEventId: args.providerEventId,
    providerMessageId: typeof email.id === "string" ? email.id : emailId,

    fromAddress,
    toAddresses: safeStringArray(email.to),
    ccAddresses: safeStringArray(email.cc),
    bccAddresses: safeStringArray(email.bcc),

    subject: typeof email.subject === "string" ? email.subject : parsed.data.data.subject ?? null,
    bodyText: typeof email.text === "string" ? email.text : null,
    bodyHtml: typeof email.html === "string" ? email.html : null,

    messageIdHeader:
      typeof email.message_id === "string"
        ? email.message_id
        : (parsed.data.data.message_id ?? null),
    inReplyTo,
    references,

    receivedAt,
    attachments: attachments && attachments.length ? attachments : null,
  };
}

