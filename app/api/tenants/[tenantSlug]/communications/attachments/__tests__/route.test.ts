import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CommunicationAttachmentValidationError } from "@/lib/communication/attachment-validation";

const mocks = vi.hoisted(() => ({
  tenantContext: vi.fn(),
  permission: vi.fn(),
  auth: vi.fn(),
  createUploaded: vi.fn(),
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.tenantContext,
}));
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.permission,
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/communication/attachment-service", () => ({
  CommunicationAttachmentServiceError: class CommunicationAttachmentServiceError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
    }
  },
  createUploadedAttachment: mocks.createUploaded,
}));

const { POST } = await import("../route");
const context = { params: Promise.resolve({ tenantSlug: "fc-a" }) };

function uploadRequest(file: File) {
  const body = new FormData();
  body.append("file", file);
  return new NextRequest(
    "http://localhost/api/tenants/fc-a/communications/attachments",
    { method: "POST", body },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenantContext.mockResolvedValue({ ok: true, tenantId: "tenant-a" });
  mocks.permission.mockResolvedValue({ ok: true });
  mocks.auth.mockResolvedValue({ user: { id: "actor-a" } });
  mocks.createUploaded.mockResolvedValue({
    id: "attachment-a",
    storageKey: "communication/tenant-a/attachment-a/vertrag.pdf",
    sanitizedFilename: "vertrag.pdf",
    contentType: "application/pdf",
    sizeBytes: 4,
    lifecycleStatus: "READY",
    scanStatus: "PENDING",
  });
});

describe("POST communication attachment", () => {
  it("uploads one file using the authoritative tenant and returns safe metadata", async () => {
    const response = await POST(
      uploadRequest(new File([new Uint8Array([1, 2, 3, 4])], "vertrag.pdf", {
        type: "application/pdf",
      })),
      context,
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.createUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        actorUserId: "actor-a",
        filename: "vertrag.pdf",
        declaredContentType: "application/pdf",
      }),
    );
    expect(payload).toEqual({
      attachment: {
        attachmentId: "attachment-a",
        filename: "vertrag.pdf",
        contentType: "application/pdf",
        size: 4,
        status: "READY",
        scanStatus: "PENDING",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("storageKey");
    expect(JSON.stringify(payload)).not.toContain("url");
  });

  it("blocks a foreign tenant before reading or persisting the multipart file", async () => {
    mocks.tenantContext.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Tenant nicht gefunden.",
    });
    const response = await POST(
      uploadRequest(new File(["text"], "notiz.txt", { type: "text/plain" })),
      context,
    );

    expect(response.status).toBe(404);
    expect(mocks.permission).not.toHaveBeenCalled();
    expect(mocks.createUploaded).not.toHaveBeenCalled();
  });

  it("rejects files larger than 10 MiB before allocation in the attachment service", async () => {
    const response = await POST(
      uploadRequest(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "gross.pdf", {
          type: "application/pdf",
        }),
      ),
      context,
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Die Datei überschreitet 10 MiB." });
    expect(mocks.createUploaded).not.toHaveBeenCalled();
  });

  it("returns a German validation error for a disallowed file type", async () => {
    mocks.createUploaded.mockRejectedValue(
      new CommunicationAttachmentValidationError(
        "TYPE_NOT_ALLOWED",
        "Dieser Dateityp ist nicht erlaubt.",
      ),
    );
    const response = await POST(
      uploadRequest(
        new File(["echo unsafe"], "script.sh", {
          type: "application/x-sh",
        }),
      ),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Dieser Dateityp ist nicht erlaubt.",
    });
  });
});
