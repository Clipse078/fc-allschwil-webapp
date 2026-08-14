/**
 * Invitation email template — SportClubEvo branding.
 *
 * Sent when an admin invites a person to join a tenant. The link
 * uses the same password-reset infrastructure (PasswordResetToken
 * with isInvitation=true) so the recipient can set their own password
 * on first login.
 */

export type InvitationEmailData = {
  inviteUrl: string;
  recipientEmail: string;
  recipientFirstName: string;
  tenantName: string;
  expiryHours: number;
  /** Absolute HTTPS base URL. Must not end with a slash. */
  appBaseUrl?: string;
};

export function buildInvitationEmail(data: InvitationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { inviteUrl, recipientFirstName, tenantName, expiryHours, appBaseUrl } = data;

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
              ${logoUrl ? `<img src="${logoUrl}" alt="SportClubEvo" width="160" style="display:block;height:auto;" />` : `<span style="font-size:20px;font-weight:700;color:#1E293B;">SportClubEvo</span>`}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1E293B;line-height:1.3;">
                Einladung zu ${tenantName}
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
                Hallo ${recipientFirstName},
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
                Du wurdest eingeladen, dem <strong>${tenantName}</strong>-Bereich auf SportClubEvo beizutreten.
                Klicke auf den untenstehenden Button, um dein Konto zu aktivieren und dein Passwort festzulegen.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background:#2563EB;border-radius:10px;">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Konto aktivieren
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-size:13px;color:#94A3B8;line-height:1.6;">
                Dieser Link ist ${expiryHours} Stunden gültig und kann nur einmal verwendet werden.
              </p>
              <p style="margin:0 0 20px;font-size:13px;color:#94A3B8;line-height:1.6;">
                Falls du diese Einladung nicht erwartest, kannst du diese E-Mail ignorieren.
                Dein Konto wird ohne Aktivierung nicht zugänglich sein.
              </p>

              <!-- Fallback URL -->
              <p style="margin:20px 0 0;font-size:12px;color:#CBD5E1;line-height:1.6;">
                Link funktioniert nicht? Kopiere diese URL in deinen Browser:<br />
                <span style="word-break:break-all;color:#94A3B8;">${inviteUrl}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F3F4F6;background:#F8FAFC;">
              <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">
                SportClubEvo · Vereinsverwaltung einfach gemacht
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

Hallo ${recipientFirstName},

Du wurdest eingeladen, dem ${tenantName}-Bereich auf SportClubEvo beizutreten.

Klicke auf den folgenden Link, um dein Konto zu aktivieren:
${inviteUrl}

Dieser Link ist ${expiryHours} Stunden gültig und kann nur einmal verwendet werden.

Falls du diese Einladung nicht erwartest, kannst du diese E-Mail ignorieren.

SportClubEvo · Vereinsverwaltung einfach gemacht
`;

  return { subject, html, text };
}
