import { Webhook } from "standardwebhooks";

export class ResendWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendWebhookVerificationError";
  }
}

export function verifyResendWebhookPayload(args: {
  rawPayload: string;
  headers: Headers;
  webhookSecret: string;
}): unknown {
  const secret = args.webhookSecret.trim();
  if (!secret) {
    throw new ResendWebhookVerificationError("Missing RESEND_WEBHOOK_SECRET");
  }

  const id =
    args.headers.get("webhook-id") ??
    args.headers.get("svix-id") ??
    args.headers.get("svix_id") ??
    "";
  const timestamp =
    args.headers.get("webhook-timestamp") ??
    args.headers.get("svix-timestamp") ??
    args.headers.get("svix_timestamp") ??
    "";
  const signature =
    args.headers.get("webhook-signature") ??
    args.headers.get("svix-signature") ??
    args.headers.get("svix_signature") ??
    "";

  try {
    const wh = new Webhook(secret);
    return wh.verify(args.rawPayload, {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    });
  } catch (err) {
    throw new ResendWebhookVerificationError(
      err instanceof Error ? err.message : "Invalid webhook signature",
    );
  }
}

export function getResendWebhookEventId(headers: Headers): string | null {
  const id =
    headers.get("webhook-id") ??
    headers.get("svix-id") ??
    headers.get("svix_id") ??
    null;
  return id?.trim() ? id.trim() : null;
}

