import { NextRequest } from "next/server";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getTenantFromSession: vi.fn(),
  upload: vi.fn(),
  delete: vi.fn(),
  createDocument: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("node:crypto")>();

  return {
    ...original,
    randomUUID: mocks.randomUUID,
  };
});

vi.mock(
  "@/lib/permissions/require-api-permission",
  () => ({
    requireApiPermission: mocks.requireApiPermission,
  }),
);

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: mocks.getTenantFromSession,
}));

vi.mock("@/lib/workspace/upload-storage", () => ({
  workspaceStorageProvider: {
    upload: mocks.upload,
    delete: mocks.delete,
  },
}));

vi.mock("@/lib/workspace/document-service", () => {
  type WorkspaceDocumentServiceErrorCode =
    | "INVALID_INPUT"
    | "FOLDER_NOT_FOUND"
    | "DUPLICATE_DOCUMENT_NAME";

  class WorkspaceDocumentServiceError extends Error {
    readonly code: WorkspaceDocumentServiceErrorCode;

    constructor(
      code: WorkspaceDocumentServiceErrorCode,
      message: string,
    ) {
      super(message);
      this.name = "WorkspaceDocumentServiceError";
      this.code = code;
    }
  }

  return {
    WorkspaceDocumentServiceError,
    createWorkspaceDocumentWithInitialVersion:
      mocks.createDocument,
  };
});

import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  WorkspaceDocumentServiceError,
} from "@/lib/workspace/document-service";
import { POST } from "@/app/api/workspace/documents/route";

const SESSION_TENANT_ID = "tenant-session";
const TENANT_ID = "tenant-1";
const TENANT_KEY = "fc-allschwil";
const ACTOR_USER_ID = "user-1";
const DOCUMENT_ID = "1234567890abcdef1234567890abcdef";

function mockAuthorizedSession(
  overrides: {
    tenantId?: string | null;
    userId?: string | null;
  } = {},
) {
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id:
          overrides.userId === undefined
            ? ACTOR_USER_ID
            : overrides.userId,
        tenantId:
          overrides.tenantId === undefined
            ? SESSION_TENANT_ID
            : overrides.tenantId,
      },
    },
  });
}

function makeMultipartRequest(
  input: {
    file?: File;
    name?: string;
    folderId?: string;
    changeNote?: string;
    extraFields?: Record<string, string>;
  } = {},
): NextRequest {
  const formData = new FormData();

  if (input.file !== undefined) {
    formData.set("file", input.file);
  }

  if (input.name !== undefined) {
    formData.set("name", input.name);
  }

  if (input.folderId !== undefined) {
    formData.set("folderId", input.folderId);
  }

  if (input.changeNote !== undefined) {
    formData.set("changeNote", input.changeNote);
  }

  for (const [key, value] of Object.entries(
    input.extraFields ?? {},
  )) {
    formData.set(key, value);
  }

  return new NextRequest(
    "http://localhost/api/workspace/documents",
    {
      method: "POST",
      body: formData,
    },
  );
}

function makePdfFile(
  name = "Trainer Handbuch.pdf",
  content = "document-content",
): File {
  return new File([content], name, {
    type: "application/pdf",
  });
}

const uploadedBlob = {
  ok: true as const,
  storageKey:
    "workspace/fc-allschwil/1234567890abcdef1234567890abcdef/v1/Trainer Handbuch.pdf",
  storageUrl: "https://blob.example.test/private-document",
  checksum:
    "1111111111111111111111111111111111111111111111111111111111111111",
  filename: "Trainer Handbuch.pdf",
  mimeType: "application/pdf" as const,
  sizeBytes: 16,
};

const createdDocument = {
  id: DOCUMENT_ID,
  tenantId: TENANT_ID,
  folderId: "folder-1",
  name: "Trainer-Handbuch",
  status: "ACTIVE",
  currentVersionId: "version-1",
  createdByUserId: ACTOR_USER_ID,
  updatedByUserId: ACTOR_USER_ID,
  archivedAt: null,
  createdAt: new Date("2026-07-16T20:00:00.000Z"),
  updatedAt: new Date("2026-07-16T20:00:00.000Z"),
  currentVersion: {
    id: "version-1",
    documentId: DOCUMENT_ID,
    versionNumber: 1,
    status: "CURRENT",
    filename: uploadedBlob.filename,
    mimeType: uploadedBlob.mimeType,
    sizeBytes: uploadedBlob.sizeBytes,
    storageKey: uploadedBlob.storageKey,
    storageUrl: uploadedBlob.storageUrl,
    checksum: uploadedBlob.checksum,
    changeNote: "Initial upload",
    createdByUserId: ACTOR_USER_ID,
    createdAt: new Date("2026-07-16T20:00:00.000Z"),
  },
};

describe("POST /api/workspace/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.randomUUID.mockReturnValue(
      "12345678-90ab-cdef-1234-567890abcdef",
    );

    mockAuthorizedSession();

    mocks.getTenantFromSession.mockResolvedValue({
      id: TENANT_ID,
      key: TENANT_KEY,
    });

    mocks.upload.mockResolvedValue(uploadedBlob);
    mocks.delete.mockResolvedValue(undefined);
    mocks.createDocument.mockResolvedValue(createdDocument);
  });

  it("checks authorization before parsing the request body", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const formData = vi.fn();

    const response = await POST({
      formData,
    } as unknown as NextRequest);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });

    expect(
      mocks.requireApiPermission,
    ).toHaveBeenCalledWith(
      PERMISSIONS.WORKSPACE_MANAGE,
    );

    expect(formData).not.toHaveBeenCalled();
    expect(mocks.getTenantFromSession).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.createDocument).not.toHaveBeenCalled();
  });

  it("returns 403 when permission is missing", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: {
        user: {
          id: ACTOR_USER_ID,
          tenantId: SESSION_TENANT_ID,
        },
      },
    });

    const response = await POST(
      makeMultipartRequest({
        file: makePdfFile(),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden",
    });

    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("returns 403 when tenant context is missing", async () => {
    mockAuthorizedSession({
      tenantId: null,
    });

    const response = await POST(
      makeMultipartRequest({
        file: makePdfFile(),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Kein Mandant in der Sitzung.",
    });

    expect(mocks.getTenantFromSession).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("returns 401 when actor user ID is missing", async () => {
    mockAuthorizedSession({
      userId: null,
    });

    const response = await POST(
      makeMultipartRequest({
        file: makePdfFile(),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Benutzer-ID fehlt in der Sitzung.",
    });

    expect(mocks.getTenantFromSession).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("returns 404 when the session tenant cannot be resolved", async () => {
    mocks.getTenantFromSession.mockResolvedValue(null);

    const response = await POST(
      makeMultipartRequest({
        file: makePdfFile(),
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Tenant nicht gefunden.",
    });

    expect(
      mocks.getTenantFromSession,
    ).toHaveBeenCalledWith(SESSION_TENANT_ID);

    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed multipart input", async () => {
    const request = new NextRequest(
      "http://localhost/api/workspace/documents",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          file: "not-multipart",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        "Ungültige Anfrage: multipart/form-data erwartet.",
    });

    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("returns 400 when the file field is missing", async () => {
    const response = await POST(
      makeMultipartRequest({
        name: "Missing file",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Kein Datei-Feld 'file' gefunden.",
    });

    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("returns 400 for a forbidden MIME type", async () => {
    const response = await POST(
      makeMultipartRequest({
        file: new File(["malware"], "malware.exe", {
          type: "application/x-msdownload",
        }),
      }),
    );

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.error).toContain(
      "Nicht erlaubter Dateityp",
    );

    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads privately and creates the initial document version", async () => {
    const response = await POST(
      makeMultipartRequest({
        file: makePdfFile(),
        name: "  Trainer-Handbuch  ",
        folderId: "  folder-1  ",
        changeNote: "  Initial upload  ",
      }),
    );

    expect(response.status).toBe(201);

    const body = await response.json();

    expect(body.document.id).toBe(DOCUMENT_ID);
    expect(body.document.name).toBe("Trainer-Handbuch");

    expect(mocks.randomUUID).toHaveBeenCalledTimes(1);

    expect(mocks.upload).toHaveBeenCalledWith({
      tenantKey: TENANT_KEY,
      documentId: DOCUMENT_ID,
      versionNumber: 1,
      filename: "Trainer Handbuch.pdf",
      mimeType: "application/pdf",
      buffer: expect.any(Uint8Array),
    });

    expect(mocks.createDocument).toHaveBeenCalledWith({
      documentId: DOCUMENT_ID,
      tenantId: TENANT_ID,
      folderId: "folder-1",
      name: "Trainer-Handbuch",
      filename: uploadedBlob.filename,
      mimeType: uploadedBlob.mimeType,
      sizeBytes: uploadedBlob.sizeBytes,
      storageKey: uploadedBlob.storageKey,
      storageUrl: uploadedBlob.storageUrl,
      checksum: uploadedBlob.checksum,
      changeNote: "Initial upload",
      actorUserId: ACTOR_USER_ID,
    });

    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("defaults the document name to the sanitized filename", async () => {
    await POST(
      makeMultipartRequest({
        file: makePdfFile("Trainer: Handbuch?.pdf"),
      }),
    );

    expect(mocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Trainer- Handbuch-.pdf",
      }),
    );
  });

  it("uses only the session tenant and server-controlled storage metadata", async () => {
    await POST(
      makeMultipartRequest({
        file: makePdfFile(),
        extraFields: {
          tenantId: "attacker-tenant",
          actorUserId: "attacker-user",
          storageKey: "attacker/storage-key",
          storageUrl: "https://attacker.invalid/file",
          checksum: "attacker-checksum",
          documentId: "attacker-document",
        },
      }),
    );

    expect(
      mocks.getTenantFromSession,
    ).toHaveBeenCalledWith(SESSION_TENANT_ID);

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantKey: TENANT_KEY,
        documentId: DOCUMENT_ID,
      }),
    );

    expect(mocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: DOCUMENT_ID,
        tenantId: TENANT_ID,
        actorUserId: ACTOR_USER_ID,
        storageKey: uploadedBlob.storageKey,
        storageUrl: uploadedBlob.storageUrl,
        checksum: uploadedBlob.checksum,
      }),
    );

    const serviceInput =
      mocks.createDocument.mock.calls[0]?.[0];

    expect(serviceInput.documentId).not.toBe(
      "attacker-document",
    );
    expect(serviceInput.tenantId).not.toBe(
      "attacker-tenant",
    );
    expect(serviceInput.actorUserId).not.toBe(
      "attacker-user",
    );
  });

  it("returns the storage error without creating a database record", async () => {
    mocks.upload.mockResolvedValue({
      ok: false,
      status: 503,
      error: "Workspace-Upload nicht verfügbar.",
    });

    const response = await POST(
      makeMultipartRequest({
        file: makePdfFile(),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Workspace-Upload nicht verfügbar.",
    });

    expect(mocks.createDocument).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it.each([
    ["INVALID_INPUT", 400],
    ["FOLDER_NOT_FOUND", 404],
    ["DUPLICATE_DOCUMENT_NAME", 409],
  ] as const)(
    "maps %s to HTTP %s and cleans up the uploaded Blob",
    async (code, expectedStatus) => {
      mocks.createDocument.mockRejectedValue(
        new WorkspaceDocumentServiceError(
          code,
          `Service error: ${code}`,
        ),
      );

      const response = await POST(
        makeMultipartRequest({
          file: makePdfFile(),
        }),
      );

      expect(response.status).toBe(expectedStatus);

      expect(await response.json()).toEqual({
        error: `Service error: ${code}`,
        code,
      });

      expect(mocks.delete).toHaveBeenCalledWith(
        uploadedBlob.storageUrl,
      );
    },
  );

  it("uses the storage key for cleanup when no storage URL exists", async () => {
    mocks.upload.mockResolvedValue({
      ...uploadedBlob,
      storageUrl: null,
    });

    mocks.createDocument.mockRejectedValue(
      new WorkspaceDocumentServiceError(
        "FOLDER_NOT_FOUND",
        "Folder not found.",
      ),
    );

    await POST(
      makeMultipartRequest({
        file: makePdfFile(),
      }),
    );

    expect(mocks.delete).toHaveBeenCalledWith(
      uploadedBlob.storageKey,
    );
  });

  it("returns 500 and cleans up after an unexpected database failure", async () => {
    mocks.createDocument.mockRejectedValue(
      new Error("Simulated database failure"),
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await POST(
      makeMultipartRequest({
        file: makePdfFile(),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Das Dokument konnte nicht erstellt werden.",
    });

    expect(mocks.delete).toHaveBeenCalledWith(
      uploadedBlob.storageUrl,
    );

    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("continues error mapping when best-effort cleanup resolves", async () => {
    mocks.createDocument.mockRejectedValue(
      new WorkspaceDocumentServiceError(
        "DUPLICATE_DOCUMENT_NAME",
        "Document already exists.",
      ),
    );

    mocks.delete.mockResolvedValue(undefined);

    const response = await POST(
      makeMultipartRequest({
        file: makePdfFile(),
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.delete).toHaveBeenCalledTimes(1);
  });
});