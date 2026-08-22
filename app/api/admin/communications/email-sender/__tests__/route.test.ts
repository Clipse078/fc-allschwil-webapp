import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.permission,
}));

vi.mock("@/lib/communication/email-sender-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/communication/email-sender-service")>();
  return {
    ...actual,
    getTenantEmailSenderSettings: mocks.getSettings,
    updateTenantEmailSenderSettings: mocks.updateSettings,
  };
});

import { GET, PATCH } from "../route";

const TENANT_A = "tenant-a";
const settings = {
  displayName: "FC Allschwil",
  emailAddress: "info@fcallschwil.ch",
  providerStatus: "VERIFIED",
  activeSource: "TENANT",
  activeFrom: "FC Allschwil <info@fcallschwil.ch>",
  platformFallbackActive: false,
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/communications/email-sender", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id: "admin-a",
        effectiveUserId: "admin-a",
        activeTenantId: TENANT_A,
      },
    },
  });
  mocks.getSettings.mockResolvedValue(settings);
  mocks.updateSettings.mockResolvedValue(settings);
});

describe("GET /api/admin/communications/email-sender", () => {
  it("allows an authorized tenant admin to load settings", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ settings });
    expect(mocks.permission).toHaveBeenCalledWith("users.manage");
    expect(mocks.getSettings).toHaveBeenCalledWith(TENANT_A);
  });

  it("blocks an unauthorized tenant user", async () => {
    mocks.permission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.getSettings).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/communications/email-sender", () => {
  it("saves name and email for the session tenant", async () => {
    const response = await PATCH(request({
      displayName: "FC Allschwil",
      emailAddress: "info@fcallschwil.ch",
    }));
    expect(response.status).toBe(200);
    expect(mocks.updateSettings).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      actorUserId: "admin-a",
      displayName: "FC Allschwil",
      emailAddress: "info@fcallschwil.ch",
    });
  });

  it("never trusts a client-provided tenantId", async () => {
    await PATCH(request({
      tenantId: "tenant-b",
      displayName: "Tenant B",
      emailAddress: "info@tenant-b.ch",
    }));
    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.updateSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-b" }),
    );
  });

  it("blocks an unauthorized mutation before parsing or writing", async () => {
    mocks.permission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });
    const malformed = new NextRequest(
      "http://localhost/api/admin/communications/email-sender",
      { method: "PATCH", body: "{bad json" },
    );
    const response = await PATCH(malformed);
    expect(response.status).toBe(403);
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("rejects a session without authoritative tenant context", async () => {
    mocks.permission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "admin-a", activeTenantId: null } },
    });
    const response = await PATCH(request({
      displayName: "FC Allschwil",
      emailAddress: "info@fcallschwil.ch",
    }));
    expect(response.status).toBe(403);
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("returns German field validation errors", async () => {
    const { EmailSenderSettingsError } =
      await import("@/lib/communication/email-sender-service");
    mocks.updateSettings.mockRejectedValue(
      new EmailSenderSettingsError(
        "INVALID_INPUT",
        "Bitte geben Sie eine gültige Absender-E-Mail ein.",
        "emailAddress",
      ),
    );
    const response = await PATCH(request({
      displayName: "FC Allschwil",
      emailAddress: "invalid",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      field: "emailAddress",
      error: "Bitte geben Sie eine gültige Absender-E-Mail ein.",
    });
  });
});
