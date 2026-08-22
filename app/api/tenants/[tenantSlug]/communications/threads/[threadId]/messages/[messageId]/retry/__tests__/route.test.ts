import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  tenantContext: vi.fn(),
  auth: vi.fn(),
  retry: vi.fn(),
  enrich: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.permission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.tenantContext,
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/communication/outbound-email-service", () => ({
  retryFailedOutboundEmailForThread: mocks.retry,
}));
vi.mock("@/lib/communication/message-enrichment", () => ({
  toPublicOutboundEmailMessages: mocks.enrich,
}));

import { POST } from "../route";

const context = {
  params: Promise.resolve({
    tenantSlug: "fc-a",
    threadId: "thread-a",
    messageId: "message-failed-a",
  }),
};

function request(headers: Record<string, string> = {}) {
  return new NextRequest(
    "http://localhost/api/tenants/fc-a/communications/threads/thread-a/messages/message-failed-a/retry",
    { method: "POST", headers },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenantContext.mockResolvedValue({ ok: true, tenantId: "tenant-a" });
  mocks.permission.mockResolvedValue({ ok: true });
  mocks.auth.mockResolvedValue({ user: { id: "actor-a" } });
  mocks.retry.mockResolvedValue({ kind: "CREATED", message: { id: "m-retry" } });
  mocks.enrich.mockResolvedValue([{ id: "m-retry", status: "SENT" }]);
});

describe("COMM-03A email retry POST authorization and boundaries", () => {
  it("enforces permissions (403) before retrying", async () => {
    mocks.permission.mockResolvedValue({ ok: false, status: 403, error: "Keine Berechtigung." });
    const response = await POST(request({ "Idempotency-Key": "k1" }) as never, context);
    expect(response.status).toBe(403);
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("requires Idempotency-Key header (400)", async () => {
    const response = await POST(request() as never, context);
    expect(response.status).toBe(400);
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("uses server-derived tenantId, actor and path params", async () => {
    const response = await POST(request({ "Idempotency-Key": "k1" }) as never, context);
    expect(response.status).toBe(201);
    expect(mocks.retry).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      threadId: "thread-a",
      actorUserId: "actor-a",
      sourceMessageId: "message-failed-a",
      idempotencyKey: "k1",
    });
  });

  it("returns 200 when the retry request is deduplicated", async () => {
    mocks.retry.mockResolvedValue({ kind: "DUPLICATE", message: { id: "m-retry" } });
    const response = await POST(request({ "Idempotency-Key": "k1" }) as never, context);
    expect(response.status).toBe(200);
  });
});

