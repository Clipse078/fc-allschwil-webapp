import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  tenantContext: vi.fn(),
  permission: vi.fn(),
  auth: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.tenantContext,
}));
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.permission,
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/communication/attachment-download-service", () => ({
  downloadCommunicationAttachment: mocks.download,
}));

const { GET } = await import("../route");
const context = {
  params: Promise.resolve({
    tenantSlug: "fc-a",
    attachmentId: "attachment-a",
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenantContext.mockResolvedValue({
    ok: true,
    tenantId: "tenant-a",
  });
  mocks.permission.mockResolvedValue({ ok: true });
  mocks.auth.mockResolvedValue({ user: { id: "user-a" } });
  mocks.download.mockResolvedValue({
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    }),
    filename: "Annual Report.pdf",
    contentType: "application/pdf",
    sizeBytes: 3,
  });
});

describe("GET communication attachment", () => {
  it("streams secure download headers and exposes no storage key or URL", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/tenants/fc-a/communications/attachments/attachment-a",
      ),
      context,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'attachment; filename="Annual Report.pdf"',
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(await response.arrayBuffer()).toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
    expect(mocks.download).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorUserId: "user-a",
      attachmentId: "attachment-a",
    });
  });

  it("blocks foreign tenant context before permission or attachment lookup", async () => {
    mocks.tenantContext.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Tenant nicht gefunden.",
    });
    const response = await GET(new NextRequest("http://localhost"), context);
    expect(response.status).toBe(404);
    expect(mocks.permission).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("blocks users without communication permission", async () => {
    mocks.permission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
    });
    const response = await GET(new NextRequest("http://localhost"), context);
    expect(response.status).toBe(403);
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
