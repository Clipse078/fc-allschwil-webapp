/**
 * INVITE-01 — Invitation email template — SportClubEvo branding.
 *
 * Sent when an admin invites a person to join a tenant.
 * Reuses the same HTML structure as the password-reset template.
 */

export type InvitationEmailData = {
  inviteUrl: string;
  recipientEmail: string;
  recipientName: string;
  tenantName: string;
  expiryHours: number;
  appBaseUrl?: string;
};

export function buildInvitationEmail(data: InvitationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { inviteUrl, recipientName, tenantName, expiryHours, appBaseUrl } = data;

  const logoUrl = appBaseUrl
    ? `${appBaseUrl}/images/branding/sportclubevo_logo.png`
    : "";

  const subject = `Einladung zu ${tenantName} — SportClubEvo`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:24px 40px;border-bottom:1px solid #F3F4F6;">
              <img
                src="${logoUrl}"
                alt="SportClubEvo"
                width="147"
                height="32"
                style="display:block;width:147px;height:32px;border:0;outline:none;"
              />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 16px;font-size:1.375rem;font-weight:700;color:#111827;letter-spacing:-0.02em;">
                Du wurdest eingeladen
              </h1>
              <p style="margin:0 0 24px;font-size:0.9375rem;line-height:1.6;color:#374151;">
                Hallo ${recipientName},<br /><br />
                Du wurdest eingeladen, dem <strong>${tenantName}</strong>-Bereich in SportClubEvo beizutreten.
                Klicke auf den Button, um dein Konto zu aktivieren.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#FF6A00 0%,#FF8533 100%);box-shadow:0 2px 10px rgba(255,106,0,0.30);">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:0.9375rem;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Einladung annehmen
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:0.875rem;line-height:1.6;color:#6B7280;">
                Dieser Link ist <strong>${expiryHours} Stunden</strong> gültig und kann nur einmal verwendet werden.
              </p>
              <p style="margin:0 0 24px;font-size:0.875rem;line-height:1.6;color:#6B7280;">
                Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
              </p>

              <!-- Fallback URL -->
              <p style="margin:0;font-size:0.75rem;line-height:1.5;color:#9CA3AF;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br />
                <a href="${inviteUrl}" style="color:#FF6A00;word-break:break-all;">${inviteUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F3F4F6;background:#F9FAFB;">
              <p style="margin:0;font-size:0.75rem;color:#9CA3AF;text-align:center;">
                © 2026 SportClubEvo — Alle Rechte vorbehalten.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Einladung zu ${tenantName} — SportClubEvo

Hallo ${recipientName},

Du wurdest eingeladen, dem ${tenantName}-Bereich in SportClubEvo beizutreten.

Klicke auf den folgenden Link, um dein Konto zu aktivieren:
${inviteUrl}

Dieser Link ist ${expiryHours} Stunden gültig und kann nur einmal verwendet werden.

Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.

— SportClubEvo
`;

  return { subject, html, text };
}
