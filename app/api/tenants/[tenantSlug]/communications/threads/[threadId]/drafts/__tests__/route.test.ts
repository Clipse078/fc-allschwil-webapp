import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  tenantContext: vi.fn(),
  auth: vi.fn(),
  createDraft: vi.fn(),
  enrich: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.permission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.tenantContext,
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/communication/draft-service", () => ({
  createCommunicationDraft: mocks.createDraft,
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
    "http://localhost/api/tenants/fc-a/communications/threads/thread-a/drafts",
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
  mocks.createDraft.mockResolvedValue({ id: "draft-a" });
  mocks.enrich.mockResolvedValue([{ id: "draft-a", status: "DRAFT" }]);
});

describe("COMM-04C draft POST authorization boundary", () => {
  it("uses only the session tenant and authenticated actor", async () => {
    const response = await POST(
      request({
        subject: "Hallo",
        bodyText: "Nachricht",
        attachmentIds: ["attachment-a"],
      }),
      context,
    );

    expect(response.status).toBe(201);
    expect(mocks.createDraft).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      threadId: "thread-a",
      actorUserId: "actor-a",
      subject: "Hallo",
      bodyText: "Nachricht",
      attachmentIds: ["attachment-a"],
    });
  });

  it("denies users without communication edit permission", async () => {
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
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });

  it("rejects client-controlled tenant and recipient fields", async () => {
    const response = await POST(
      request({
        subject: "Hallo",
        bodyText: "Nachricht",
        tenantId: "tenant-b",
        recipient: "attacker@example.com",
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });
});
