/**
 * SECURITY-GO-LIVE-01D — forgot-password abuse-protection tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_SECURITY_MESSAGES } from "@/lib/security/abuse-policy";

const mockFindUnique = vi.fn();
const mockCreatePasswordResetToken = vi.fn();
const mockSendMail = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("@/lib/auth/password-reset", () => ({
  createPasswordResetToken: mockCreatePasswordResetToken,
  TOKEN_EXPIRY_MS: 60 * 60 * 1000,
}));

vi.mock("@/lib/email/mailer", () => ({
  sendMail: mockSendMail,
  MailConfigurationError: class MailConfigurationError extends Error {},
}));

vi.mock("@/lib/email/templates/password-reset", () => ({
  buildPasswordResetEmail: vi.fn(() => ({
    subject: "Reset",
    html: "<p>reset</p>",
    text: "reset",
  })),
}));

const { POST } = await import("../route");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_BASE_URL = "https://stage.sportclubevo.app";
  mockFindUnique.mockResolvedValue(null);
  mockCreatePasswordResetToken.mockResolvedValue("raw-token-not-logged");
  mockSendMail.mockResolvedValue(undefined);
});

describe("POST /api/auth/forgot-password", () => {
  it("returns the same opaque success for unknown and known emails", async () => {
    const unknownReq = new NextRequest("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.30" },
      body: JSON.stringify({ email: "unknown@example.com" }),
    });
    const unknownRes = await POST(unknownReq);
    const unknownBody = await unknownRes.json();

    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "known@example.com",
      isActive: true,
    });

    const knownReq = new NextRequest("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.31" },
      body: JSON.stringify({ email: "known@example.com" }),
    });
    const knownRes = await POST(knownReq);
    const knownBody = await knownRes.json();

    expect(unknownRes.status).toBe(200);
    expect(knownRes.status).toBe(200);
    expect(unknownBody.message).toBe(AUTH_SECURITY_MESSAGES.forgotPasswordSuccess);
    expect(knownBody.message).toBe(unknownBody.message);
  });

  it("returns generic 429 with Retry-After when rate limited", async () => {
    const ip = `10.66.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;

    for (let i = 0; i < 5; i += 1) {
      const req = new NextRequest("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      await POST(req);
    }

    const blockedReq = new NextRequest("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    const blocked = await POST(blockedReq);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    const body = await blocked.json();
    expect(body.error).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/known@|unknown@|exist/i);
  });
});
