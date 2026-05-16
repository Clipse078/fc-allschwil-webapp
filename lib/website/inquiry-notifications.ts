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

function hasEmailProvider(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY ||
      process.env.SENDGRID_API_KEY ||
      process.env.SMTP_HOST
  );
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
): Promise<void> {
  if (!recipientEmail) {
    console.log(
      "[inquiry-notification] No recipient configured — skipping. " +
        "Set inquiryNotificationEmail in Website-Einstellungen."
    );
    return;
  }

  if (!hasEmailProvider()) {
    console.log(
      `[inquiry-notification] No email provider configured (RESEND_API_KEY / SENDGRID_API_KEY / SMTP_HOST). ` +
        `Would notify ${recipientEmail} for inquiry ${payload.id}.`
    );
    return;
  }

  // Provider routing — extend here when a provider env var is present
  const body = formatNotificationBody(payload);

  if (process.env.RESEND_API_KEY) {
    await sendViaResend(recipientEmail, payload, body);
    return;
  }

  // Additional providers (SendGrid, SMTP) can be added here
  console.log(
    `[inquiry-notification] Provider present but not yet wired for this key type. ` +
      `Would notify ${recipientEmail}.`
  );
}

async function sendViaResend(
  to: string,
  payload: InquiryNotificationPayload,
  body: string
): Promise<void> {
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
      const err = await response.text().catch(() => "unknown");
      console.error(`[inquiry-notification] Resend error ${response.status}: ${err}`);
    } else {
      console.log(`[inquiry-notification] Sent via Resend to ${to} for inquiry ${payload.id}`);
    }
  } catch (err) {
    console.error("[inquiry-notification] Resend fetch failed:", err);
  }
}
