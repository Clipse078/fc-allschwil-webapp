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
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
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
