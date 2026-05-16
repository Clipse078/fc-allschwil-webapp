export type InquiryNotificationPayload = {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string | null;
  message: string;
  sourcePath: string | null;
};

export type NotificationResult = {
  status: "NOT_CONFIGURED" | "SKIPPED" | "SENT" | "FAILED";
  error?: string;
};

export function hasEmailProvider(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY ||
      process.env.SENDGRID_API_KEY ||
      process.env.SMTP_HOST
  );
}

export function getActiveProviderName(): string | null {
  if (process.env.RESEND_API_KEY) return "Resend";
  if (process.env.SENDGRID_API_KEY) return "SendGrid";
  if (process.env.SMTP_HOST) return "SMTP";
  return null;
}

function formatNotificationBody(payload: InquiryNotificationPayload): string {
  return [
    `Neue Website-Anfrage (#${payload.id})`,
    `Typ: ${payload.type}`,
    `Name: ${payload.name}`,
    `E-Mail: ${payload.email}`,
    payload.phone ? `Telefon: ${payload.phone}` : null,
    payload.topic ? `Thema: ${payload.topic}` : null,
    "",
    "Nachricht:",
    payload.message,
    "",
    payload.sourcePath ? `Herkunft: ${payload.sourcePath}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function notifyWebsiteInquiryCreated(
  payload: InquiryNotificationPayload,
  recipientEmail: string | null
): Promise<NotificationResult> {
  if (!recipientEmail) {
    console.log(
      "[inquiry-notification] No recipient configured — skipping. " +
        "Set inquiryNotificationEmail in Website-Einstellungen."
    );
    return { status: "NOT_CONFIGURED" };
  }

  if (!hasEmailProvider()) {
    console.log(
      `[inquiry-notification] No email provider configured. ` +
        `Would notify ${recipientEmail} for inquiry ${payload.id}.`
    );
    return { status: "SKIPPED" };
  }

  const body = formatNotificationBody(payload);

  if (process.env.RESEND_API_KEY) {
    return sendViaResend(recipientEmail, payload, body);
  }

  console.log(
    `[inquiry-notification] Provider env present but send path not wired for current key type. ` +
      `Would notify ${recipientEmail}.`
  );
  return { status: "SKIPPED" };
}

async function sendViaResend(
  to: string,
  payload: InquiryNotificationPayload,
  body: string
): Promise<NotificationResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@updates.yourclub.ch",
        to: [to],
        subject: `Neue Anfrage: ${payload.topic ?? payload.type} — ${payload.name}`,
        text: body,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      const msg = `Resend ${response.status}: ${errText}`;
      console.error(`[inquiry-notification] ${msg}`);
      return { status: "FAILED", error: msg };
    }

    console.log(
      `[inquiry-notification] Sent via Resend to ${to} for inquiry ${payload.id}`
    );
    return { status: "SENT" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[inquiry-notification] Resend fetch failed:", msg);
    return { status: "FAILED", error: msg };
  }
}
