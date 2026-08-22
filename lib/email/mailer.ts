/**
 * SportClubEvo — outbound email via Resend.
 *
 * Required server-side environment variables (never NEXT_PUBLIC_):
 *
 *   RESEND_API_KEY   Resend API key (re_...) from resend.com
 *   EMAIL_FROM       Verified sender address.
 *                    Production canonical value:
 *                      SportClubEvo <noreply@mail.sportclubevo.com>
 *                    The sending domain (mail.sportclubevo.com) must be
 *                    verified in the Resend dashboard with SPF, DKIM,
 *                    and the optional Resend CNAME tracking record.
 *
 * TRACKING (click / open):
 *   The Resend SDK v6 does not expose per-email tracking toggles —
 *   these are domain-level settings only.
 *   Operator action required to disable tracking:
 *     1. Go to Resend dashboard → Domains → mail.sportclubevo.com → Settings.
 *     2. Disable "Click Tracking" and "Open Tracking".
 *   This applies to all emails sent from the domain, including password-reset.
 *   No code change can substitute for this dashboard action.
 *
 * Missing configuration throws MailConfigurationError — the caller is
 * responsible for treating this as an operational failure while keeping
 * the external API response opaque.
 *
 * Why Resend instead of generic SMTP/Nodemailer:
 *   - Single API key vs five SMTP env vars.
 *   - No peer-dependency conflicts (Nodemailer@9 conflicts with next-auth@beta).
 *   - Serverless/Vercel-native HTTP transport; no persistent SMTP connection.
 *   - Free tier covers SportClubEvo transactional volume.
 *
 * Dev/test must mock this module explicitly — there is no silent stdout fallback.
 */

import { Resend } from "resend";

export const RESEND_MAX_ENCODED_MESSAGE_BYTES = 40 * 1024 * 1024;

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type MailMessage = {
  /** Optional provider-authorized sender. Unusable custom senders fall back to EMAIL_FROM. */
  from?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  idempotencyKey?: string;
  attachments?: MailAttachment[];
};

export type MailDeliveryResult = {
  providerMessageId: string;
  from: string;
};

export type SenderDomainAuthorization = "VERIFIED" | "NOT_VERIFIED" | "UNKNOWN";

/**
 * Thrown when required email configuration (RESEND_API_KEY or EMAIL_FROM)
 * is absent or empty. Callers should log this as an operational/configuration
 * failure without exposing details to the end user.
 */
export class MailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailConfigurationError";
  }
}

export class MailAttachmentPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailAttachmentPreflightError";
  }
}

function estimateEncodedMessageBytes(message: MailMessage): number {
  const textBytes = Buffer.byteLength(
    `${message.from ?? ""}${message.to}${message.subject}${message.html}${message.text ?? ""}${message.replyTo ?? ""}`,
    "utf8",
  );
  const attachmentBytes = (message.attachments ?? []).reduce(
    (total, attachment) =>
      total +
      4 * Math.ceil(attachment.content.byteLength / 3) +
      Buffer.byteLength(attachment.filename + attachment.contentType, "utf8"),
    0,
  );
  return textBytes + attachmentBytes;
}

function extractEmailDomain(value: string): string | null {
  const address = value.match(/<([^<>]+)>$/)?.[1] ?? value;
  const at = address.lastIndexOf("@");
  if (at <= 0 || at === address.length - 1) return null;
  return address.slice(at + 1).trim().toLowerCase();
}

/**
 * Checks the exact sender domain against Resend without mutating provider state.
 * Restricted/missing provider credentials are UNKNOWN and must never authorize.
 */
export async function getSenderDomainAuthorization(
  emailAddress: string,
): Promise<SenderDomainAuthorization> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const domain = extractEmailDomain(emailAddress.trim());
  if (!apiKey || !domain) return "UNKNOWN";

  try {
    const resend = new Resend(apiKey);
    let after: string | undefined;

    for (let page = 0; page < 100; page += 1) {
      const { data, error } = await resend.domains.list({ limit: 100, after });
      if (error || !data) return "UNKNOWN";

      const match = data.data.find((candidate) => candidate.name.toLowerCase() === domain);
      if (match) {
        return match.status === "verified" && match.capabilities.sending === "enabled"
          ? "VERIFIED"
          : "NOT_VERIFIED";
      }

      if (!data.has_more || data.data.length === 0) return "NOT_VERIFIED";
      after = data.data.at(-1)?.id;
      if (!after) return "UNKNOWN";
    }
  } catch {
    return "UNKNOWN";
  }

  return "UNKNOWN";
}

/**
 * Sends a transactional email via Resend.
 *
 * Throws MailConfigurationError when RESEND_API_KEY or EMAIL_FROM is missing.
 * Throws on delivery failure (Resend API error).
 *
 * Never logs the message body, reset tokens, or reset URLs.
 */
export async function sendMail(message: MailMessage): Promise<MailDeliveryResult> {
  if (estimateEncodedMessageBytes(message) > RESEND_MAX_ENCODED_MESSAGE_BYTES) {
    throw new MailAttachmentPreflightError(
      "The encoded email payload exceeds Resend's 40 MiB message limit.",
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new MailConfigurationError(
      "RESEND_API_KEY is not configured. Email delivery is unavailable.",
    );
  }

  const platformFrom = process.env.EMAIL_FROM?.trim();
  if (!platformFrom) {
    throw new MailConfigurationError(
      "EMAIL_FROM is not configured. Email delivery is unavailable.",
    );
  }

  let from = platformFrom;
  const requestedFrom = message.from?.trim();
  if (requestedFrom && requestedFrom !== platformFrom) {
    const authorization = await getSenderDomainAuthorization(requestedFrom);
    if (authorization === "VERIFIED") {
      from = requestedFrom;
    }
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send(
    {
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      attachments: message.attachments,
    },
    message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
  );

  if (error) {
    throw new Error(`Resend delivery error: ${error.name} — ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Resend delivery error: response did not include a message id.");
  }

  return { providerMessageId: data.id, from };
}
