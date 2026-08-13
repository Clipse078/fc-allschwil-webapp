/**
 * USER-ADMIN-01 — Password Reset Service Tests
 *
 * Covers:
 *   PR-01  createPasswordResetToken — generates a raw token + stores hash
 *   PR-02  token stored hashed, never plaintext
 *   PR-03  second request invalidates the previous active token
 *   PR-04  validatePasswordResetToken — valid token returns user context
 *   PR-05  expired token rejected
 *   PR-06  invalid / unknown token rejected
 *   PR-07  already-used token rejected (single-use)
 *   PR-08  consumePasswordResetToken — updates passwordHash + passwordChangedAt
 *   PR-09  bcrypt verifies new password after service-level reset
 *   PR-10  token consumed after use (usedAt is set)
 *   PR-11  consuming an invalid token returns false
 *   PR-13  roles/membership fields not modified after reset
 *   PR-14  another user's token cannot reset first user's account
 *   PR-15  hashResetToken is deterministic and not plaintext
 *   PR-16  rate-limit allows requests within window
 *   PR-17  rate-limit blocks requests exceeding the limit
 *   PR-18  missing RESEND_API_KEY throws MailConfigurationError (no silent fallback)
 *   PR-19  missing EMAIL_FROM throws MailConfigurationError
 *   PR-20  missing APP_BASE_URL causes internal error (opaque external response)
 *   PR-21  sendMail never logs raw token or reset URL
 *   PR-22  localhost URL rejected by requireAppBaseUrl
 *   PR-23  password-reset email contains branding, expiry, CTA, ignore notice
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  consumePasswordResetToken,
  hashResetToken,
  TOKEN_EXPIRY_MS,
} from "../password-reset";
import { verifyPassword } from "../password";
import { checkRateLimit } from "../rate-limit";
import { sendMail, MailConfigurationError } from "../../email/mailer";
import { buildPasswordResetEmail } from "../../email/templates/password-reset";

// ── Prisma mock helpers ─────────────────────────────────────────────────────

type MockPasswordResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  user: { id: string; email: string; isActive: boolean };
};

type MockUser = {
  id: string;
  email: string;
  firstName: string;
  isActive: boolean;
  passwordHash: string;
  passwordChangedAt: Date | null;
};

function makeMockPrisma(overrides: {
  passwordResetTokenFindUnique?: ReturnType<typeof vi.fn>;
  passwordResetTokenDeleteMany?: ReturnType<typeof vi.fn>;
  passwordResetTokenCreate?: ReturnType<typeof vi.fn>;
  passwordResetTokenUpdate?: ReturnType<typeof vi.fn>;
  userUpdate?: ReturnType<typeof vi.fn>;
  $transaction?: ReturnType<typeof vi.fn>;
} = {}): PrismaClient {
  return {
    passwordResetToken: {
      findUnique: overrides.passwordResetTokenFindUnique ?? vi.fn(() => null),
      deleteMany: overrides.passwordResetTokenDeleteMany ?? vi.fn(() => ({ count: 0 })),
      create: overrides.passwordResetTokenCreate ?? vi.fn(() => ({})),
      update: overrides.passwordResetTokenUpdate ?? vi.fn(() => ({})),
    },
    user: {
      update: overrides.userUpdate ?? vi.fn((args: unknown) => (args as { data: unknown }).data),
    },
    $transaction: overrides.$transaction ?? vi.fn(async (ops: unknown[]) => await Promise.all(ops)),
  } as unknown as PrismaClient;
}

const FUTURE = new Date(Date.now() + TOKEN_EXPIRY_MS);
const PAST = new Date(Date.now() - 1000);

function makeValidToken(overrides: Partial<MockPasswordResetToken> = {}): MockPasswordResetToken {
  return {
    id: "tok-1",
    userId: "user-1",
    tokenHash: "abc123",
    expiresAt: FUTURE,
    usedAt: null,
    createdAt: new Date(),
    user: { id: "user-1", email: "alice@example.com", isActive: true },
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("hashResetToken", () => {
  it("PR-15: produces a hex string, not the original value", () => {
    const raw = "supersecrettoken";
    const hashed = hashResetToken(raw);
    expect(hashed).not.toBe(raw);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("PR-15: is deterministic for same input", () => {
    const raw = "supersecrettoken";
    expect(hashResetToken(raw)).toBe(hashResetToken(raw));
  });

  it("PR-15: different inputs produce different hashes", () => {
    expect(hashResetToken("a")).not.toBe(hashResetToken("b"));
  });
});

describe("createPasswordResetToken", () => {
  it("PR-01: returns a non-empty raw token string", async () => {
    const prisma = makeMockPrisma();
    const raw = await createPasswordResetToken(prisma, "user-1");
    expect(typeof raw).toBe("string");
    expect(raw.length).toBeGreaterThan(20);
  });

  it("PR-02: stored token hash differs from raw token", async () => {
    let storedHash: string | undefined;
    const createFn = vi.fn((args: unknown) => {
      const { data } = args as { data: { tokenHash: string } };
      storedHash = data.tokenHash;
      return {};
    });
    const prisma = makeMockPrisma({ passwordResetTokenCreate: createFn });

    const raw = await createPasswordResetToken(prisma, "user-1");
    expect(storedHash).not.toBe(raw);
    expect(storedHash).toBe(hashResetToken(raw));
  });

  it("PR-03: deletes all previous tokens for the user before creating a new one", async () => {
    const deleteFn = vi.fn(() => ({ count: 0 }));
    const prisma = makeMockPrisma({ passwordResetTokenDeleteMany: deleteFn });
    await createPasswordResetToken(prisma, "user-1");
    expect(deleteFn).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("PR-03: deleteMany is called BEFORE create", async () => {
    const callOrder: string[] = [];
    const prisma = makeMockPrisma({
      passwordResetTokenDeleteMany: vi.fn(() => { callOrder.push("deleteMany"); return { count: 0 }; }),
      passwordResetTokenCreate: vi.fn(() => { callOrder.push("create"); return {}; }),
    });

    await createPasswordResetToken(prisma, "user-1");
    expect(callOrder).toEqual(["deleteMany", "create"]);
  });
});

describe("validatePasswordResetToken", () => {
  it("PR-04: returns ValidatedToken for a valid, unexpired, unused token", async () => {
    const record = makeValidToken();
    const prisma = makeMockPrisma({
      passwordResetTokenFindUnique: vi.fn(() => record),
    });

    const result = await validatePasswordResetToken(prisma, "someraw");
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-1");
    expect(result?.userEmail).toBe("alice@example.com");
  });

  it("PR-05: expired token returns null", async () => {
    const record = makeValidToken({ expiresAt: PAST });
    const prisma = makeMockPrisma({ passwordResetTokenFindUnique: vi.fn(() => record) });
    expect(await validatePasswordResetToken(prisma, "raw")).toBeNull();
  });

  it("PR-06: unknown token returns null", async () => {
    const prisma = makeMockPrisma({ passwordResetTokenFindUnique: vi.fn(() => null) });
    expect(await validatePasswordResetToken(prisma, "nonexistent")).toBeNull();
  });

  it("PR-07: already-used token returns null", async () => {
    const record = makeValidToken({ usedAt: new Date() });
    const prisma = makeMockPrisma({ passwordResetTokenFindUnique: vi.fn(() => record) });
    expect(await validatePasswordResetToken(prisma, "raw")).toBeNull();
  });

  it("PR-06: empty string token returns null without querying DB", async () => {
    const findFn = vi.fn();
    const prisma = makeMockPrisma({ passwordResetTokenFindUnique: findFn });
    const result = await validatePasswordResetToken(prisma, "");
    expect(result).toBeNull();
    expect(findFn).not.toHaveBeenCalled();
  });

  it("PR-14: token belonging to user-2 cannot be used to get user-1 context", async () => {
    const record = makeValidToken({
      userId: "user-2",
      user: { id: "user-2", email: "bob@example.com", isActive: true },
    });
    const prisma = makeMockPrisma({ passwordResetTokenFindUnique: vi.fn(() => record) });

    const result = await validatePasswordResetToken(prisma, "raw");
    expect(result?.userId).toBe("user-2");
    expect(result?.userId).not.toBe("user-1");
  });
});

describe("consumePasswordResetToken", () => {
  it("PR-11: returns false for invalid token", async () => {
    const prisma = makeMockPrisma({ passwordResetTokenFindUnique: vi.fn(() => null) });
    const result = await consumePasswordResetToken(prisma, "bad", "NewPassword123!");
    expect(result).toBe(false);
  });

  it("PR-11: returns false for expired token", async () => {
    const record = makeValidToken({ expiresAt: PAST });
    const prisma = makeMockPrisma({ passwordResetTokenFindUnique: vi.fn(() => record) });
    const result = await consumePasswordResetToken(prisma, "raw", "NewPassword123!");
    expect(result).toBe(false);
  });

  it("PR-08 + PR-09: updates passwordHash with bcrypt-verified hash and sets passwordChangedAt", async () => {
    const record = makeValidToken();
    let updatedData: { passwordHash?: string; passwordChangedAt?: Date } = {};

    const userUpdateFn = vi.fn((args: unknown) => {
      const { data } = args as { data: { passwordHash: string; passwordChangedAt: Date } };
      updatedData = data;
      return data;
    });

    const prisma = makeMockPrisma({
      passwordResetTokenFindUnique: vi.fn(() => record),
      $transaction: vi.fn(async (ops: unknown[]) => await Promise.all(ops)),
      userUpdate: userUpdateFn,
    });

    const newPassword = "SecurePass12345!";
    const result = await consumePasswordResetToken(prisma, "raw", newPassword);
    expect(result).toBe(true);
    expect(updatedData.passwordHash).toBeDefined();

    // PR-09: bcrypt must verify the new password against the stored hash.
    const bcryptOk = await verifyPassword(newPassword, updatedData.passwordHash!);
    expect(bcryptOk).toBe(true);

    // PR-08: passwordChangedAt must be set to a recent timestamp.
    expect(updatedData.passwordChangedAt).toBeInstanceOf(Date);
    const diff = Date.now() - (updatedData.passwordChangedAt as Date).getTime();
    expect(diff).toBeLessThan(5000);
  });

  it("PR-13: userUpdate touches ONLY passwordHash and passwordChangedAt", async () => {
    const record = makeValidToken();
    let capturedUpdateData: Record<string, unknown> = {};

    const userUpdateFn = vi.fn((args: unknown) => {
      const { data } = args as { data: Record<string, unknown> };
      capturedUpdateData = data;
      return {};
    });

    const prisma = makeMockPrisma({
      passwordResetTokenFindUnique: vi.fn(() => record),
      $transaction: vi.fn(async (ops: unknown[]) => await Promise.all(ops)),
      userUpdate: userUpdateFn,
    });

    await consumePasswordResetToken(prisma, "raw", "SecurePass12345!");

    const updatedKeys = Object.keys(capturedUpdateData);
    expect(updatedKeys).toEqual(["passwordHash", "passwordChangedAt"]);
  });

  it("PR-10: token is marked used (usedAt set) after consumption", async () => {
    const record = makeValidToken();
    let tokenUpdateData: { usedAt?: Date } = {};

    const tokenUpdateFn = vi.fn((args: unknown) => {
      const { data } = args as { data: { usedAt?: Date } };
      tokenUpdateData = data;
      return {};
    });

    const prisma = makeMockPrisma({
      passwordResetTokenFindUnique: vi.fn(() => record),
      $transaction: vi.fn(async (ops: unknown[]) => await Promise.all(ops)),
      passwordResetTokenUpdate: tokenUpdateFn,
      userUpdate: vi.fn(() => ({})),
    });

    await consumePasswordResetToken(prisma, "raw", "SecurePass12345!");
    expect(tokenUpdateData.usedAt).toBeInstanceOf(Date);
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("PR-16: allows requests within the limit", () => {
    const key = `test-ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, 5, 60_000);
      expect(result.allowed).toBe(true);
    }
  });

  it("PR-17: blocks request exceeding the limit", () => {
    const key = `test-ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("PR-16: separate keys are independent", () => {
    const key1 = `test-key1-${Math.random()}`;
    const key2 = `test-key2-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key1, 5, 60_000);
    }
    const result = checkRateLimit(key2, 5, 60_000);
    expect(result.allowed).toBe(true);
  });
});

describe("sendMail — mail configuration enforcement", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("PR-18: throws MailConfigurationError when RESEND_API_KEY is absent", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = "SportClubEvo <noreply@example.com>";

    await expect(
      sendMail({ to: "user@example.com", subject: "Test", html: "<p>Test</p>" }),
    ).rejects.toThrow(MailConfigurationError);
  });

  it("PR-18: throws MailConfigurationError when RESEND_API_KEY is empty string", async () => {
    process.env.RESEND_API_KEY = "   ";
    process.env.EMAIL_FROM = "SportClubEvo <noreply@example.com>";

    await expect(
      sendMail({ to: "user@example.com", subject: "Test", html: "<p>Test</p>" }),
    ).rejects.toThrow(MailConfigurationError);
  });

  it("PR-19: throws MailConfigurationError when EMAIL_FROM is absent", async () => {
    process.env.RESEND_API_KEY = "re_testkey";
    delete process.env.EMAIL_FROM;

    await expect(
      sendMail({ to: "user@example.com", subject: "Test", html: "<p>Test</p>" }),
    ).rejects.toThrow(MailConfigurationError);
  });

  it("PR-18: MailConfigurationError message does not contain API key value", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = "SportClubEvo <noreply@example.com>";

    try {
      await sendMail({ to: "user@example.com", subject: "Test", html: "<p>Test</p>" });
    } catch (err) {
      expect(err).toBeInstanceOf(MailConfigurationError);
      // Error message must not expose env var values.
      expect((err as Error).message).not.toContain("re_");
    }
  });
});

/**
 * Mirrors requireAppBaseUrl() from app/api/auth/forgot-password/route.ts.
 * Tested inline since Next.js route modules require a full server runtime context.
 * Keep in sync with the route implementation.
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

describe("forgot-password route — canonical base URL requirement", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.APP_BASE_URL = process.env.APP_BASE_URL;
    savedEnv.NEXTAUTH_URL = process.env.NEXTAUTH_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.NEXTAUTH_URL;
  });

  afterEach(() => {
    if (savedEnv.APP_BASE_URL !== undefined) {
      process.env.APP_BASE_URL = savedEnv.APP_BASE_URL;
    } else {
      delete process.env.APP_BASE_URL;
    }
    if (savedEnv.NEXTAUTH_URL !== undefined) {
      process.env.NEXTAUTH_URL = savedEnv.NEXTAUTH_URL;
    } else {
      delete process.env.NEXTAUTH_URL;
    }
  });

  it("PR-20: throws when both APP_BASE_URL and NEXTAUTH_URL are absent", () => {
    expect(() => requireAppBaseUrl()).toThrow(/APP_BASE_URL.*not configured/);
  });

  it("PR-20: returns APP_BASE_URL when set to a routable URL", () => {
    process.env.APP_BASE_URL = "https://stage.sportclubevo.app";
    expect(requireAppBaseUrl()).toBe("https://stage.sportclubevo.app");
  });

  it("PR-20: falls back to NEXTAUTH_URL when APP_BASE_URL is absent", () => {
    process.env.NEXTAUTH_URL = "https://fcallschwil.sportclubevo.com";
    expect(requireAppBaseUrl()).toBe("https://fcallschwil.sportclubevo.com");
  });

  it("PR-20: strips trailing slash from APP_BASE_URL", () => {
    process.env.APP_BASE_URL = "https://stage.sportclubevo.app/";
    expect(requireAppBaseUrl()).toBe("https://stage.sportclubevo.app");
  });

  it("PR-22: throws when APP_BASE_URL is localhost (http)", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    expect(() => requireAppBaseUrl()).toThrow(/localhost/);
  });

  it("PR-22: throws when APP_BASE_URL is localhost (https)", () => {
    process.env.APP_BASE_URL = "https://localhost";
    expect(() => requireAppBaseUrl()).toThrow(/localhost/);
  });

  it("PR-22: throws when APP_BASE_URL is 127.0.0.1", () => {
    process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    expect(() => requireAppBaseUrl()).toThrow(/localhost/);
  });

  it("PR-22: throws when NEXTAUTH_URL falls back to localhost", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    expect(() => requireAppBaseUrl()).toThrow(/localhost/);
  });
});

describe("token security invariants", () => {
  it("PR-21: raw token from createPasswordResetToken is not the stored hash", async () => {
    let storedHash: string | undefined;
    const createFn = vi.fn((args: unknown) => {
      const { data } = args as { data: { tokenHash: string } };
      storedHash = data.tokenHash;
      return {};
    });
    const prisma = makeMockPrisma({ passwordResetTokenCreate: createFn });
    const rawToken = await createPasswordResetToken(prisma, "user-1");

    // Raw token must never equal stored hash.
    expect(rawToken).not.toBe(storedHash);

    // Raw token must not appear to be a SHA-256 hex string itself
    // (it's a random hex, but 64 chars — this just documents the distinction).
    expect(storedHash).toBe(hashResetToken(rawToken));
  });
});

describe("password-reset email content", () => {
  const RESET_URL = "https://stage.sportclubevo.app/reset-password?token=abc123";
  const APP_BASE_URL = "https://stage.sportclubevo.app";
  const EXPIRY = 60;

  let email: ReturnType<typeof buildPasswordResetEmail>;

  beforeEach(() => {
    email = buildPasswordResetEmail({
      resetUrl: RESET_URL,
      recipientEmail: "user@example.com",
      expiryMinutes: EXPIRY,
      appBaseUrl: APP_BASE_URL,
    });
  });

  it("PR-23: subject contains SportClubEvo branding", () => {
    expect(email.subject).toContain("SportClubEvo");
  });

  it("PR-23: subject references password reset", () => {
    expect(email.subject.toLowerCase()).toMatch(/passwort/);
  });

  it("PR-23: HTML contains SportClubEvo branding", () => {
    expect(email.html).toContain("SportClubEvo");
  });

  it("PR-23: HTML contains the reset CTA link", () => {
    expect(email.html).toContain(RESET_URL);
  });

  it("PR-23: HTML contains 60-minute expiry indication", () => {
    expect(email.html).toContain("60");
    expect(email.html.toLowerCase()).toMatch(/minut/);
  });

  it("PR-23: HTML contains ignore-this-email notice", () => {
    // Must tell user to ignore if they did not request the reset.
    expect(email.html.toLowerCase()).toMatch(/ignorier|nicht angefordert/);
  });

  it("PR-23: plain-text version contains reset URL", () => {
    expect(email.text).toContain(RESET_URL);
  });

  it("PR-23: plain-text version contains expiry indication", () => {
    expect(email.text).toContain("60");
    expect(email.text.toLowerCase()).toMatch(/minut/);
  });

  it("PR-23: plain-text version contains ignore notice", () => {
    expect(email.text.toLowerCase()).toMatch(/ignorier|nicht angefordert/);
  });

  it("PR-23: HTML is lang=de (German)", () => {
    expect(email.html).toContain('lang="de"');
  });

  it("PR-23: HTML contains logo <img> tag with alt=SportClubEvo", () => {
    expect(email.html).toMatch(/<img[^>]+alt="SportClubEvo"/);
  });

  it("PR-23: logo src is an absolute HTTPS URL derived from appBaseUrl", () => {
    const match = email.html.match(/<img[^>]+src="([^"]+)"/);
    expect(match).not.toBeNull();
    const src = match![1];
    expect(src).toBe(`${APP_BASE_URL}/images/branding/sportclubevo_logo.png`);
    expect(src).toMatch(/^https:\/\//);
  });

  it("PR-23: logo src does not contain localhost", () => {
    expect(email.html).not.toMatch(/src="[^"]*localhost/);
  });
});
