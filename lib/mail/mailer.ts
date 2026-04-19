type MailMessageInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getBaseUrl() {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  const fallback = appBaseUrl || nextAuthUrl;

  if (!fallback) {
    throw new Error("APP_BASE_URL oder NEXTAUTH_URL ist nicht gesetzt.");
  }

  return fallback.replace(/\/$/, "");
}

export function buildInviteUrl(token: string) {
  return getBaseUrl() + "/invite/" + encodeURIComponent(token);
}

export function buildPasswordResetUrl(token: string) {
  return getBaseUrl() + "/reset-password/" + encodeURIComponent(token);
}

export async function sendMail(input: MailMessageInput) {
  const provider = process.env.MAIL_PROVIDER?.trim()?.toLowerCase() ?? "log";

  if (provider === "log") {
    console.log("[mail-log]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });

    return { ok: true as const };
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim();

    if (!apiKey || !from) {
      throw new Error("RESEND_API_KEY oder MAIL_FROM ist nicht gesetzt.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error("Mailversand fehlgeschlagen: " + body);
    }

    return { ok: true as const };
  }

  throw new Error("MAIL_PROVIDER nicht unterstützt.");
}

export async function sendInviteMail(args: {
  to: string;
  firstName: string;
  inviteUrl: string;
}) {
  return sendMail({
    to: args.to,
    subject: "Einladung zum FC Allschwil Clubmanager",
    text:
      "Hallo " +
      args.firstName +
      ",\n\n" +
      "du wurdest für den FC Allschwil Clubmanager eingeladen.\n" +
      "Bitte öffne den folgenden Link und setze sofort dein persönliches Passwort:\n\n" +
      args.inviteUrl +
      "\n\n" +
      "Der Link ist zeitlich begrenzt gültig.",
    html:
      "<p>Hallo " +
      args.firstName +
      ",</p>" +
      "<p>du wurdest für den <strong>FC Allschwil Clubmanager</strong> eingeladen.</p>" +
      "<p>Bitte öffne den folgenden Link und setze sofort dein persönliches Passwort:</p>" +
      '<p><a href="' +
      args.inviteUrl +
      '">' +
      args.inviteUrl +
      "</a></p>" +
      "<p>Der Link ist zeitlich begrenzt gültig.</p>",
  });
}

export async function sendPasswordResetMail(args: {
  to: string;
  firstName: string;
  resetUrl: string;
}) {
  return sendMail({
    to: args.to,
    subject: "Passwort neu setzen – FC Allschwil Clubmanager",
    text:
      "Hallo " +
      args.firstName +
      ",\n\n" +
      "ein Admin hat für dich einen Link erstellt, um dein Passwort neu zu setzen.\n" +
      "Bitte öffne den folgenden Link:\n\n" +
      args.resetUrl +
      "\n\n" +
      "Der Link ist zeitlich begrenzt gültig.",
    html:
      "<p>Hallo " +
      args.firstName +
      ",</p>" +
      "<p>ein Admin hat für dich einen Link erstellt, um dein Passwort neu zu setzen.</p>" +
      '<p><a href="' +
      args.resetUrl +
      '">' +
      args.resetUrl +
      "</a></p>" +
      "<p>Der Link ist zeitlich begrenzt gültig.</p>",
  });
}
