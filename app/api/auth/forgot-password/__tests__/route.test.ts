import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  createPasswordResetToken: vi.fn(),
  checkRateLimit: vi.fn(),
  sendMail: vi.fn(),
  buildPasswordResetEmail: vi.fn((_input: unknown) => ({
    subject: "Reset",
    html: "<p>Reset</p>",
    text: "Reset",
  })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
  },
}));
vi.mock("@/lib/auth/password-reset", () => ({
  createPasswordResetToken: mocks.createPasswordResetToken,
  TOKEN_EXPIRY_MS: 60 * 60 * 1000,
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock("@/lib/email/mailer", () => ({
  sendMail: mocks.sendMail,
  MailConfigurationError: class MailConfigurationError extends Error {},
}));
vi.mock("@/lib/email/templates/password-reset", () => ({
  buildPasswordResetEmail: mocks.buildPasswordResetEmail,
}));

import { POST } from "../route";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalNextAuthUrl = process.env.NEXTAUTH_URL;

function makeRequest() {
  return new Request("http://hostile.example/api/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: "hostile.example",
      "X-Forwarded-Host": "hostile.example",
    },
    body: JSON.stringify({ email: "user@example.test" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_BASE_URL = "https://canonical.example.test";
  delete process.env.NEXTAUTH_URL;
  mocks.checkRateLimit.mockReturnValue({ allowed: true });
  mocks.userFindUnique.mockResolvedValue({
    id: "user-1",
    email: "user@example.test",
    isActive: true,
  });
  mocks.createPasswordResetToken.mockResolvedValue("reset+a/b?c=d%e");
  mocks.sendMail.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = originalAppBaseUrl;
  if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = originalNextAuthUrl;
  vi.restoreAllMocks();
});

describe("POST /api/auth/forgot-password security link generation", () => {
  it("uses the canonical base and encodes the reset token once", async () => {
    const response = await POST(makeRequest() as never);

    expect(response.status).toBe(200);
    const input = mocks.buildPasswordResetEmail.mock.calls[0]?.[0] as {
      resetUrl: string;
    };
    const resetUrl = new URL(input.resetUrl);
    expect(resetUrl.origin).toBe("https://canonical.example.test");
    expect(resetUrl.pathname).toBe("/reset-password");
    expect(resetUrl.searchParams.get("token")).toBe("reset+a/b?c=d%e");
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  it("fails closed before token creation or provider invocation", async () => {
    process.env.APP_BASE_URL =
      "https://operator:credential@hostile.example/unexpected?token=secret";
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(makeRequest() as never);

    expect(response.status).toBe(200);
    expect(mocks.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mocks.buildPasswordResetEmail).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
