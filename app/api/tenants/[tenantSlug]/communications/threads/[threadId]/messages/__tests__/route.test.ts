import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  tenantContext: vi.fn(),
  requireThread: vi.fn(),
  listMessages: vi.fn(),
  resolveRecipient: vi.fn(),
  enrich: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.permission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.tenantContext,
}));
vi.mock("@/lib/communication/thread-service", () => ({
  requireCommunicationThreadForTenant: mocks.requireThread,
}));
vi.mock("@/lib/communication/message-service", () => ({
  listCommunicationMessages: mocks.listMessages,
}));
vi.mock("@/lib/communication/recipient-resolver", () => ({
  resolveCommunicationRecipientForTarget: mocks.resolveRecipient,
}));
vi.mock("@/lib/communication/message-enrichment", () => ({
  toPublicEmailThreadMessages: mocks.enrich,
}));

const { GET } = await import("../route");

const context = {
  params: Promise.resolve({ tenantSlug: "fc-a", threadId: "thread-a" }),
};

function request() {
  return new NextRequest(
    "http://localhost/api/tenants/fc-a/communications/threads/thread-a/messages",
    { method: "GET" },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenantContext.mockResolvedValue({ ok: true, tenantId: "tenant-a" });
  mocks.permission.mockResolvedValue({ ok: true });
  mocks.requireThread.mockResolvedValue({ id: "thread-a", tenantId: "tenant-a", targetType: "REGISTRATION", targetId: "reg-a" });
  mocks.listMessages.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
  mocks.resolveRecipient.mockResolvedValue({ available: true, email: "anna@example.com", sendAllowed: true, displayName: "Anna", unavailableReason: null });
  mocks.enrich.mockResolvedValue([{ id: "m1", direction: "INBOUND" }, { id: "m2", direction: "OUTBOUND" }]);
});

describe("COMM-02 communication history GET", () => {
  it("enforces permissions (403) before returning messages", async () => {
    mocks.permission.mockResolvedValue({ ok: false, status: 403, error: "Keine Berechtigung." });
    const res = await GET(request() as never, context);
    expect(res.status).toBe(403);
    expect(mocks.listMessages).not.toHaveBeenCalled();
  });

  it("returns enriched inbound+outbound messages for authorized users", async () => {
    const res = await GET(request() as never, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(mocks.enrich).toHaveBeenCalledWith("tenant-a", [{ id: "m1" }, { id: "m2" }]);
  });
});
