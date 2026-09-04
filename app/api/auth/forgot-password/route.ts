/**
 * POST /api/auth/forgot-password
 *
 * USER-ADMIN-01 — Forgot-password request endpoint.
 *
 * Security properties:
 *   - Opaque response: always returns the same 200 JSON regardless of
 *     whether the email exists — never reveals user enumeration.
 *   - Rate limiting: application best-effort 5 / 15 min per IP; Vercel WAF
 *     provides distributed protection (see docs/security/vercel-auth-rate-limits.md).
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
import { sendMail, MailConfigurationError } from "@/lib/email/mailer";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";
import { getClientIp } from "@/lib/security/client-ip";
import {
  AUTH_SECURITY_MESSAGES,
  checkApplicationRateLimit,
} from "@/lib/security/abuse-policy";
import { createRateLimitResponse } from "@/lib/security/rate-limit-response";

const OPAQUE_SUCCESS = {
  message: AUTH_SECURITY_MESSAGES.forgotPasswordSuccess,
};

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
export function requireAppBaseUrl(): string {
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
  const ip = getClientIp(req);
  const rateCheck = checkApplicationRateLimit("forgotPassword", ip);
  if (!rateCheck.allowed) {
    return createRateLimitResponse(rateCheck.retryAfterMs);
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
        appBaseUrl,
      });

      await sendMail({ to: userEmail, subject, html, text });
    } catch (err) {
      const isConfigError = err instanceof MailConfigurationError;

      if (isConfigError) {
        // Operational/configuration failure — visible in logs, not to caller.
        console.error("[forgot-password] mail configuration error:", (err as Error).message);
      } else {
        console.error(
          "[forgot-password] token/email delivery failed",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  return NextResponse.json(OPAQUE_SUCCESS, { status: 200 });
}
