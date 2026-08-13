/**
 * USER-ADMIN-01-C4 — Auth page authenticated-user redirect regression tests
 *
 * Covers:
 *   REDIR-01  authenticated user on /reset-password — NO redirect (page renders)
 *   REDIR-02  unauthenticated user on /reset-password — NO redirect (page renders)
 *   REDIR-03  authenticated user on /login — DOES redirect to /dashboard
 *   REDIR-04  unauthenticated user on /login — NO redirect (page renders)
 *
 * These tests verify the routing/middleware layer only.
 * Token lifecycle (validate/consume) is covered by lib/auth/__tests__/password-reset.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
const mockRedirect = vi.fn((url: string): never => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

// ResetPasswordForm renders nothing meaningful in a node test env; stub it.
vi.mock("@/components/auth/ResetPasswordForm", () => ({
  default: () => null,
}));
vi.mock("@/components/auth/LoginForm", () => ({
  default: () => null,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSession() {
  return { user: { id: "user-1", email: "alice@example.com" } };
}

async function runPage(importPath: string): Promise<{ redirected: false } | { redirected: true; to: string }> {
  // Dynamic import is required so vi.mock stubs are applied per-test
  // (vitest hoists vi.mock calls to before any static import).
  const mod = await import(importPath);
  const Page = mod.default;
  try {
    await Page();
    return { redirected: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/^REDIRECT:(.+)$/);
    if (match) {
      return { redirected: true, to: match[1] };
    }
    throw err;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("/reset-password page — authenticated-user redirect exemption", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRedirect.mockImplementation((url: string): never => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  it("REDIR-01: authenticated user is NOT redirected — page renders token form", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const result = await runPage("../reset-password/page");
    expect(result.redirected).toBe(false);
  });

  it("REDIR-02: unauthenticated user is NOT redirected — page renders token form", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await runPage("../reset-password/page");
    expect(result.redirected).toBe(false);
  });
});

describe("/login page — authenticated-user redirect remains unchanged", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRedirect.mockImplementation((url: string): never => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  it("REDIR-03: authenticated user IS redirected to /dashboard", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const result = await runPage("../login/page");
    expect(result).toEqual({ redirected: true, to: "/dashboard" });
  });

  it("REDIR-04: unauthenticated user is NOT redirected — login form renders", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await runPage("../login/page");
    expect(result.redirected).toBe(false);
  });
});
