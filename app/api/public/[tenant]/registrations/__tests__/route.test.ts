/**
 * SECURITY-GO-LIVE-01D — public registration abuse-protection tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockResolveTenant = vi.fn();
const mockAssertWebsiteEnabled = vi.fn();
const mockValidatePublicPayload = vi.fn();
const mockCreatePublicRegistration = vi.fn();

vi.mock("@/lib/website/response-helpers", () => ({
  resolveTenantFromParams: mockResolveTenant,
  assertWebsiteEnabled: mockAssertWebsiteEnabled,
}));

vi.mock("@/lib/registrations/public-submission", () => ({
  validatePublicPayload: mockValidatePublicPayload,
  createPublicRegistration: mockCreatePublicRegistration,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { POST } = await import("../route");

const TENANT = { id: "tenant-1", key: "fca", slug: "fca", websiteEnabled: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenant.mockResolvedValue(TENANT);
  mockAssertWebsiteEnabled.mockReturnValue(null);
  mockValidatePublicPayload.mockReturnValue({
    valid: true,
    data: { firstName: "Test", lastName: "User", email: "test@example.com" },
  });
  mockCreatePublicRegistration.mockResolvedValue({
    registrationId: "reg-1",
    status: "NEW",
  });
});

describe("POST /api/public/[tenant]/registrations", () => {
  it("silently accepts honeypot submissions without creating records", async () => {
    const req = new NextRequest("http://localhost/api/public/fca/registrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
      body: JSON.stringify({ _hp: "bot-value", firstName: "Bot" }),
    });

    const res = await POST(req, { params: Promise.resolve({ tenant: "fca" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.registrationId).toBe("honeypot");
    expect(mockCreatePublicRegistration).not.toHaveBeenCalled();
  });

  it("returns canonical 429 when rate limited", async () => {
    const ip = `10.77.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;

    for (let i = 0; i < 5; i += 1) {
      const req = new NextRequest("http://localhost/api/public/fca/registrations", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ firstName: "A", lastName: "B", email: "a@example.com" }),
      });
      await POST(req, { params: Promise.resolve({ tenant: "fca" }) });
    }

    const blockedReq = new NextRequest("http://localhost/api/public/fca/registrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ firstName: "A", lastName: "B", email: "a@example.com" }),
    });
    const blocked = await POST(blockedReq, { params: Promise.resolve({ tenant: "fca" }) });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    const body = await blocked.json();
    expect(body.ok).toBe(false);
  });
});
