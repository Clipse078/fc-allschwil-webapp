/**
 * Canonical application-layer abuse policy for authentication and
 * identity-related public surfaces.
 *
 * Architecture:
 *   EDGE (Vercel WAF)     — coarse distributed burst protection (see docs)
 *   APPLICATION (this)    — local semantics: cooldowns, generic responses,
 *                           best-effort in-process rate limits
 *
 * The in-process limiter is defense-in-depth only — not a distributed store.
 */

import { checkRateLimit, type RateLimitResult } from "@/lib/auth/rate-limit";

// ── WAF contract (documentation mirror — configure manually in Vercel) ────────

export const WAF_AUTH_RATE_LIMITS = {
  authenticationBurst: {
    name: "Authentication burst protection",
    pathPatterns: ["/api/auth/*"],
    methods: ["POST"],
    countingKey: "IP",
    threshold: 10,
    windowSeconds: 60,
    action: "rate_limit",
    rationale:
      "Credential stuffing and brute-force burst protection for Auth.js and related auth POST endpoints.",
  },
  forgotPassword: {
    name: "Password reset request",
    pathPatterns: ["/api/auth/forgot-password"],
    methods: ["POST"],
    countingKey: "IP",
    threshold: 5,
    windowSeconds: 600,
    action: "rate_limit",
    rationale: "Reset-email abuse protection; complements application opaque responses.",
  },
  resetAndInvitationTokens: {
    name: "Reset / invitation token submission",
    pathPatterns: ["/api/auth/reset-password", "/api/auth/invitation/accept"],
    methods: ["POST"],
    countingKey: "IP",
    threshold: 10,
    windowSeconds: 600,
    action: "rate_limit",
    rationale: "Token guessing and automated submission protection.",
  },
  publicRegistrations: {
    name: "Public registrations",
    pathPatterns: ["/api/public/*/registrations"],
    methods: ["POST"],
    countingKey: "IP",
    threshold: 10,
    windowSeconds: 60,
    action: "rate_limit",
    rationale: "High-volume automated registration spam protection.",
  },
  adminInviteResend: {
    name: "Admin invite resend",
    pathPatterns: ["/api/admin/users/*/invite"],
    methods: ["POST"],
    countingKey: "IP",
    threshold: 20,
    windowSeconds: 600,
    action: "rate_limit",
    rationale:
      "Looser edge threshold because route requires users.invite; application cooldown is stronger.",
  },
} as const;

// ── Application in-process limits (best-effort, single-instance) ────────────

export const APP_RATE_LIMITS = {
  login: { limit: 10, windowMs: 60_000 },
  forgotPassword: { limit: 5, windowMs: 15 * 60_000 },
  resetPassword: { limit: 10, windowMs: 10 * 60_000 },
  invitationAccept: { limit: 10, windowMs: 10 * 60_000 },
  publicRegistration: { limit: 5, windowMs: 60_000 },
} as const;

/** Minimum time between invitation resends per tenant + target user. */
export const INVITATION_RESEND_COOLDOWN_MS = 60_000;

// ── Generic, non-enumerating user-facing messages ─────────────────────────────

export const AUTH_SECURITY_MESSAGES = {
  invalidCredentials: "Ungültige E-Mail oder Passwort. Bitte nochmals versuchen.",
  invalidOrExpiredToken:
    "Ungültiger oder abgelaufener Link. Bitte fordere einen neuen an.",
  invalidInvitationLink:
    "Einladungslink ist ungültig, abgelaufen oder bereits verwendet.",
  forgotPasswordSuccess:
    "Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen des Passworts gesendet.",
} as const;

export type AbusePolicySurface =
  | "login"
  | "forgotPassword"
  | "resetPassword"
  | "invitationAccept"
  | "publicRegistration";

/**
 * Best-effort in-process rate limit check for a sensitive surface.
 * Primary distributed protection is Vercel WAF — see WAF_AUTH_RATE_LIMITS.
 */
export function checkApplicationRateLimit(
  surface: AbusePolicySurface,
  identityKey: string,
): RateLimitResult {
  const config = APP_RATE_LIMITS[surface];
  return checkRateLimit(`${surface}:${identityKey}`, config.limit, config.windowMs);
}
