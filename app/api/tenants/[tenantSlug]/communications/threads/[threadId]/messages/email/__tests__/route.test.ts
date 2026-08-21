import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  tenantContext: vi.fn(),
  auth: vi.fn(),
  send: vi.fn(),
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
  sendOutboundEmailForThread: mocks.send,
}));
vi.mock("@/lib/communication/message-enrichment", () => ({
  toPublicOutboundEmailMessages: mocks.enrich,
}));

import { POST } from "../route";

const context = {
  params: Promise.resolve({ tenantSlug: "fc-a", threadId: "thread-a" }),
};

function request(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/tenants/fc-a/communications/threads/thread-a/messages/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenantContext.mockResolvedValue({ ok: true, tenantId: "tenant-a" });
  mocks.permission.mockResolvedValue({ ok: true });
  mocks.auth.mockResolvedValue({ user: { id: "actor-a" } });
  mocks.send.mockResolvedValue({ id: "message-a" });
  mocks.enrich.mockResolvedValue([{ id: "message-a", status: "SENT" }]);
});

describe("COMM-01C email POST authorization and client-control boundary", () => {
  it("F — view-only user cannot send", async () => {
    mocks.permission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Keine Berechtigung.",
    });

    const response = await POST(
      request({ subject: "Hallo", bodyText: "Nachricht" }),
      context,
    );

    expect(response.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("G — registrations.edit user can send with server-derived tenant and actor", async () => {
    const response = await POST(
      request({ subject: "Hallo", bodyText: "Nachricht" }),
      context,
    );

    expect(response.status).toBe(201);
    expect(mocks.send).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      threadId: "thread-a",
      actorUserId: "actor-a",
      subject: "Hallo",
      bodyText: "Nachricht",
    });
  });

  it.each([
    ["D — client-supplied recipient override is rejected", { recipient: "attacker@example.com" }],
    ["E — client-supplied tenantId is rejected", { tenantId: "tenant-b" }],
  ])("%s", async (_label, extra) => {
    const response = await POST(
      request({ subject: "Hallo", bodyText: "Nachricht", ...extra }),
      context,
    );

    expect(response.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
