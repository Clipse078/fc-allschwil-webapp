import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  tenantContext: vi.fn(),
  auth: vi.fn(),
  prismaFindFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.permission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.tenantContext,
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    registration: {
      findFirst: mocks.prismaFindFirst,
    },
  },
}));
vi.mock("@/lib/registrations/contact-email-service", () => ({
  updateRegistrationContactEmailForTenant: mocks.update,
}));

const { GET, PATCH } = await import("../route");

const context = {
  params: Promise.resolve({ tenantSlug: "fc-a", registrationId: "reg-a" }),
};

function patchRequest(body: unknown) {
  return new NextRequest(
    "http://localhost/api/tenants/fc-a/registrations/reg-a/contact-email",
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
}

function getRequest() {
  return new NextRequest(
    "http://localhost/api/tenants/fc-a/registrations/reg-a/contact-email",
    { method: "GET" },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenantContext.mockResolvedValue({ ok: true, tenantId: "tenant-a" });
  mocks.permission.mockResolvedValue({ ok: true });
  mocks.auth.mockResolvedValue({ user: { id: "actor-a" } });
  mocks.prismaFindFirst.mockResolvedValue({ id: "reg-a", email: "old@example.com" });
  mocks.update.mockResolvedValue({ id: "reg-a", email: "new@example.com" });
});

describe("COMM-03A addendum: contact email route", () => {
  it("requires edit permission for PATCH", async () => {
    mocks.permission.mockResolvedValue({ ok: false, status: 403, error: "Keine Berechtigung." });
    const res = await PATCH(patchRequest({ email: "x@example.com" }) as never, context);
    expect(res.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects invalid payload (400)", async () => {
    const res = await PATCH(patchRequest({ nope: true }) as never, context);
    expect(res.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates email using server-derived actor + tenant context", async () => {
    const res = await PATCH(patchRequest({ email: "new@example.com" }) as never, context);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.email).toBe("new@example.com");
    expect(mocks.update).toHaveBeenCalledWith("fc-a", "reg-a", "new@example.com", "actor-a");
  });

  it("returns 404 on GET when registration is not in tenant boundary", async () => {
    mocks.prismaFindFirst.mockResolvedValue(null);
    const res = await GET(getRequest() as never, context);
    expect(res.status).toBe(404);
  });
});

