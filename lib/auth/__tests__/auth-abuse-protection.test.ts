/**
 * SECURITY-GO-LIVE-01D — focused auth abuse-protection tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { AUTH_SECURITY_MESSAGES } from "@/lib/security/abuse-policy";

const mockHandlersPost = vi.fn();
const mockHandlersGet = vi.fn();

vi.mock("@/auth", () => ({
  handlers: {
    GET: mockHandlersGet,
    POST: mockHandlersPost,
  },
}));

describe("Auth.js credentials route wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlersPost.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  it("rate-limits credentials login POST with canonical 429", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    const ip = `10.99.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;

    for (let i = 0; i < 10; i += 1) {
      const req = new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
      });
      const res = await POST(req);
      expect(res.status).not.toBe(429);
    }

    const blockedReq = new NextRequest("http://localhost/api/auth/callback/credentials", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
    });
    const blocked = await POST(blockedReq);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    const body = await blocked.json();
    expect(body.error).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/email|password/i);
    expect(mockHandlersPost).toHaveBeenCalledTimes(10);
  });

  it("does not rate-limit non-credentials auth POST paths", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    const req = new NextRequest("http://localhost/api/auth/signout", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.55" },
    });
    await POST(req);
    expect(mockHandlersPost).toHaveBeenCalledTimes(1);
  });
});

describe("login generic bad-credentials behavior", () => {
  it("exposes a single generic invalid-credentials message", () => {
    expect(AUTH_SECURITY_MESSAGES.invalidCredentials).toBe(
      "Ungültige E-Mail oder Passwort. Bitte nochmals versuchen.",
    );
  });
});

describe("authorize() logging invariants", () => {
  it("does not log email prefixes or password outcomes in auth.ts", () => {
    const source = readFileSync(resolve(process.cwd(), "auth.ts"), "utf8");
    expect(source).not.toMatch(/email prefix/i);
    expect(source).not.toMatch(/user inactive/i);
    expect(source).not.toMatch(/bcrypt comparison failed/i);
    expect(source).toContain("runLoginTimingMitigation");
  });
});
