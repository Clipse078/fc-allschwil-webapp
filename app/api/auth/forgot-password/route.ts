/**
 * POST /api/auth/forgot-password
 *
 * USER-ADMIN-01 — Forgot-password request endpoint.
 *
 * Security properties:
 *   - Opaque response: always returns the same 200 JSON regardless of
 *     whether the email exists — never reveals user enumeration.
 *   - Rate limiting: 5 requests per IP per 15-minute window.
 *     NOTE: best-effort only — in-process store is not shared across
 *     Vercel serverless instances. See rate-limit.ts for details.
 *   - Token: raw token is never logged; only the SHA-256 hash is stored.
 *   - Reset URL: constructed from APP_BASE_URL (preferred) or NEXTAUTH_URL.
 *     If neither is configured, email delivery fails internally (operational
 *     error) while the external response remains opaque.
 *   - Missing RESEND_API_KEY or EMAIL_FROM: email delivery fails internally
 *     (MailConfigurationError) while the external response remains opaque.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createPasswordResetToken, TOKEN_EXPIRY_MS } from "@/lib/auth/password-reset";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { sendMail, MailConfigurationError } from "@/lib/email/mailer";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";

const OPAQUE_SUCCESS = {
  message:
    "Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen des Passworts gesendet.",
};

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Returns the canonical application base URL from environment configuration.
 * Prefers APP_BASE_URL, falls back to NEXTAUTH_URL.
 *
 * Throws if:
 *   - Neither APP_BASE_URL nor NEXTAUTH_URL is configured.
 *   - The resolved URL points to localhost or 127.0.0.1 (not a routable
 *     production URL; reset links sent to that address are unusable).
 *
 * The caller must catch and log the error; the external response stays opaque.
 */
function requireAppBaseUrl(): string {
  const url =
    process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");

  if (!url) {
    throw new Error(
      "APP_BASE_URL (or NEXTAUTH_URL) is not configured. Cannot construct password reset URL.",
    );
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?($|\/)/.test(url)) {
    throw new Error(
      "APP_BASE_URL resolves to localhost. Password reset emails require a publicly routable URL.",
    );
  }

  return url;
}

export async function POST(req: NextRequest) {
  // Best-effort rate limiting by IP. Not shared across serverless instances.
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json(OPAQUE_SUCCESS, { status: 200 });
  }

  let email: string;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
  }

  // Look up the user — never reveal the result to the caller.
  let userId: string | null = null;
  let userEmail: string | null = null;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    if (user && user.isActive) {
      userId = user.id;
      userEmail = user.email;
    }
  } catch (err) {
    console.error(
      "[forgot-password] user lookup error",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(OPAQUE_SUCCESS, { status: 200 });
  }

  // If the user exists and is active, create a token and attempt delivery.
  // All internal failures are caught and logged without exposing token values,
  // reset URLs, or account existence to the caller.
  if (userId && userEmail) {
    try {
      const rawToken = await createPasswordResetToken(prisma, userId);
      const appBaseUrl = requireAppBaseUrl();
      const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;
      const expiryMinutes = Math.round(TOKEN_EXPIRY_MS / 60000);

      const { subject, html, text } = buildPasswordResetEmail({
        resetUrl,
        recipientEmail: userEmail,
        expiryMinutes,
      });

      await sendMail({ to: userEmail, subject, html, text });
    } catch (err) {
      const isConfigError = err instanceof MailConfigurationError;
      const emailPrefix = (userEmail ?? "").slice(0, 3) + "***";

      if (isConfigError) {
        // Operational/configuration failure — visible in logs, not to caller.
        console.error("[forgot-password] mail configuration error:", (err as Error).message);
      } else {
        console.error(
          "[forgot-password] token/email error for prefix",
          emailPrefix,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  return NextResponse.json(OPAQUE_SUCCESS, { status: 200 });
}
