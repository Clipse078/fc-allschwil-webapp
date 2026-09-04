/**
 * SECURITY-GO-LIVE-01D — reset-password token enumeration tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_SECURITY_MESSAGES } from "@/lib/security/abuse-policy";

const mockValidatePasswordResetToken = vi.fn();
const mockConsumePasswordResetToken = vi.fn();
const mockActivateInvitationMembership = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/auth/password-reset", () => ({
  validatePasswordResetToken: mockValidatePasswordResetToken,
  consumePasswordResetToken: mockConsumePasswordResetToken,
}));

vi.mock("@/lib/users/mutations", () => ({
  activateInvitationMembership: mockActivateInvitationMembership,
}));

const { POST } = await import("../route");

beforeEach(() => {
  vi.clearAllMocks();
  mockValidatePasswordResetToken.mockResolvedValue(null);
  mockConsumePasswordResetToken.mockResolvedValue(false);
});

describe("POST /api/auth/reset-password", () => {
  it("returns a generic error for invalid tokens without exposing details", async () => {
    const req = new NextRequest("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.40" },
      body: JSON.stringify({
        token: "super-secret-token-value",
        newPassword: "ValidPassword12",
        confirmPassword: "ValidPassword12",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(AUTH_SECURITY_MESSAGES.invalidOrExpiredToken);
    expect(JSON.stringify(body)).not.toContain("super-secret-token-value");
  });
});
