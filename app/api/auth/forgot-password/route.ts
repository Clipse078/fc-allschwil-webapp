/**
 * POST /api/auth/forgot-password
 *
 * USER-ADMIN-01 — Forgot-password request endpoint.
 *
 * Security properties:
 *   - Opaque response: always returns the same 200 JSON regardless of
 *     whether the email exists — never reveals user enumeration.
 *   - Rate limiting: 5 requests per IP per 15-minute window.
 *   - Token: raw token is never logged; only the SHA-256 hash is stored.
 *   - APP_BASE_URL: reset URL is constructed from the canonical env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { sendMail } from "@/lib/email/mailer";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";
import { TOKEN_EXPIRY_MS } from "@/lib/auth/password-reset";

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

export async function POST(req: NextRequest) {
  // Rate-limit by IP.
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

  // Look up the user — but never reveal the result to the caller.
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
    console.error("[forgot-password] user lookup error", err instanceof Error ? err.message : String(err));
    return NextResponse.json(OPAQUE_SUCCESS, { status: 200 });
  }

  // If the user exists and is active, create a token and send the email.
  // Any failure is caught and silently discarded to preserve opacity.
  if (userId && userEmail) {
    try {
      const rawToken = await createPasswordResetToken(prisma, userId);

      const appBaseUrl =
        process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ??
        process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "") ??
        "http://localhost:3000";

      const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;
      const expiryMinutes = Math.round(TOKEN_EXPIRY_MS / 60000);

      const { subject, html, text } = buildPasswordResetEmail({
        resetUrl,
        recipientEmail: userEmail,
        expiryMinutes,
      });

      await sendMail({ to: userEmail, subject, html, text });
    } catch (err) {
      console.error(
        "[forgot-password] token/email error for email prefix",
        (userEmail ?? "").slice(0, 3) + "***",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return NextResponse.json(OPAQUE_SUCCESS, { status: 200 });
}
