/**
 * Password-reset email template — SportClubEvo branding.
 *
 * Accepts the raw reset URL (already constructed by the caller from
 * APP_BASE_URL — never hard-coded here).
 */

export type PasswordResetEmailData = {
  resetUrl: string;
  recipientEmail: string;
  expiryMinutes: number;
};

export function buildPasswordResetEmail(data: PasswordResetEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { resetUrl, expiryMinutes } = data;

  const subject = "Passwort zurücksetzen — SportClubEvo";

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
            <td style="padding:32px 40px 24px;border-bottom:1px solid #F3F4F6;">
              <span style="font-size:1.1rem;font-weight:700;color:#111827;letter-spacing:-0.01em;">
                SportClub<span style="color:#FF6A00;">Evo</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 16px;font-size:1.375rem;font-weight:700;color:#111827;letter-spacing:-0.02em;">
                Passwort zurücksetzen
              </h1>
              <p style="margin:0 0 24px;font-size:0.9375rem;line-height:1.6;color:#374151;">
                Wir haben eine Anfrage erhalten, das Passwort für dein SportClubEvo-Konto
                zurückzusetzen. Klicke auf den Button, um ein neues Passwort zu wählen.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#FF6A00 0%,#FF8533 100%);box-shadow:0 2px 10px rgba(255,106,0,0.30);">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:0.9375rem;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Passwort zurücksetzen
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:0.875rem;line-height:1.6;color:#6B7280;">
                Dieser Link ist <strong>${expiryMinutes} Minuten</strong> gültig und kann nur einmal verwendet werden.
              </p>
              <p style="margin:0 0 24px;font-size:0.875rem;line-height:1.6;color:#6B7280;">
                Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.
                Dein Passwort bleibt unverändert.
              </p>

              <!-- Fallback URL -->
              <p style="margin:0;font-size:0.75rem;line-height:1.5;color:#9CA3AF;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br />
                <a href="${resetUrl}" style="color:#FF6A00;word-break:break-all;">${resetUrl}</a>
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

  const text = `Passwort zurücksetzen — SportClubEvo

Wir haben eine Anfrage erhalten, das Passwort für dein SportClubEvo-Konto zurückzusetzen.

Klicke auf den folgenden Link, um ein neues Passwort zu wählen:
${resetUrl}

Dieser Link ist ${expiryMinutes} Minuten gültig und kann nur einmal verwendet werden.

Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren. Dein Passwort bleibt unverändert.

— SportClubEvo
`;

  return { subject, html, text };
}
