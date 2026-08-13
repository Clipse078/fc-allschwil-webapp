/**
 * SportClubEvo — outbound email via nodemailer / SMTP.
 *
 * Required environment variables (server-side only, never NEXT_PUBLIC_):
 *
 *   SMTP_HOST        SMTP server hostname, e.g. smtp.sendgrid.net
 *   SMTP_PORT        SMTP port (default 587)
 *   SMTP_SECURE      "true" for port 465 TLS; omit or "false" for STARTTLS (port 587)
 *   SMTP_USER        SMTP auth username
 *   SMTP_PASS        SMTP auth password / API key
 *   EMAIL_FROM       Sender address, e.g. "SportClubEvo <noreply@yourdomain.com>"
 *
 * In local/CI environments where SMTP_HOST is absent the mailer logs the
 * email to stdout instead of sending it (safe for automated tests, safe for
 * development without a real SMTP account).
 */

import nodemailer, { type Transporter } from "nodemailer";

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function buildTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT?.trim() ?? "587", 10);
  const secure = process.env.SMTP_SECURE?.trim() === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER?.trim(),
      pass: process.env.SMTP_PASS?.trim(),
    },
  });
}

/**
 * Sends a transactional email.
 *
 * - In production (SMTP_HOST configured): sends via SMTP.
 * - In development / CI (SMTP_HOST absent): logs to stdout and returns
 *   a mock success — never throws, never reveals token data beyond the
 *   recipient address.
 *
 * Throws on SMTP delivery failure (caller should handle gracefully).
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const from = process.env.EMAIL_FROM?.trim() ?? "SportClubEvo <noreply@sportclubevo.app>";
  const transporter = buildTransporter();

  if (!transporter) {
    // Development / CI fallback: print to stdout (never includes token values).
    console.log(
      "[mailer:dev] Would send email",
      JSON.stringify({ to: message.to, subject: message.subject }),
    );
    return;
  }

  await transporter.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
