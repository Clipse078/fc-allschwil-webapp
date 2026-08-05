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
  restoreWorkspaceDocument: vi.fn(),
}));

vi.mock(
  "@/lib/permissions/require-api-permission",
  () => ({
    requireApiPermission:
      mocks.requireApiPermission,
  }),
);

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession:
    mocks.getTenantFromSession,
}));

vi.mock(
  "@/lib/workspace/document-restore-service",
  () => {
    type ErrorCode =
      | "INVALID_INPUT"
      | "DOCUMENT_NOT_FOUND"
      | "TENANT_FORBIDDEN"
      | "DOCUMENT_ALREADY_ACTIVE";

    class WorkspaceDocumentRestoreServiceError extends Error {
      readonly code: ErrorCode;

      constructor(
        code: ErrorCode,
        message: string,
      ) {
        super(message);

        this.name =
          "WorkspaceDocumentRestoreServiceError";

        this.code = code;
      }
    }

    return {
      restoreWorkspaceDocument:
        mocks.restoreWorkspaceDocument,
      WorkspaceDocumentRestoreServiceError,
    };
  },
);

import { POST } from "@/app/api/workspace/documents/[documentId]/restore/route";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { WorkspaceDocumentRestoreServiceError } from "@/lib/workspace/document-restore-service";

const SessionTenantId = "session-tenant";
const TenantId = "tenant-1";
const UserId = "user-1";
const DocumentId = "document-1";

function configureAuthorizedSession(
  tenantId: string | null = SessionTenantId,
  userId: string | null = UserId,
) {
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id: userId,
        activeTenantId: tenantId,
      },
    },
  });
}

function createRequest(): Request {
  return new Request(
    `http://localhost/api/workspace/documents/${DocumentId}/restore`,
    {
      method: "POST",
    },
  );
}

function createContext() {
  return {
    params: Promise.resolve({
      documentId: DocumentId,
    }),
  };
}

describe(
  "POST /api/workspace/documents/[documentId]/restore",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      configureAuthorizedSession();

      mocks.getTenantFromSession.mockResolvedValue({
        id: TenantId,
        key: "fc-allschwil",
      });

      mocks.restoreWorkspaceDocument.mockResolvedValue({
        documentId: DocumentId,
        status: "ACTIVE",
        archivedAt: null,
        updatedByUserId: UserId,
      });
    });

    it("requires WORKSPACE_MANAGE", async () => {
      mocks.requireApiPermission.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Forbidden",
        session: null,
      });

      const response = await POST(
        createRequest(),
        createContext(),
      );

      expect(response.status).toBe(403);

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: "Forbidden",
      });

      expect(
        mocks.requireApiPermission,
      ).toHaveBeenCalledWith(
        PERMISSIONS.WORKSPACE_MANAGE,
      );

      expect(
        mocks.restoreWorkspaceDocument,
      ).not.toHaveBeenCalled();
    });

    it("returns 200 after restoring the document", async () => {
      const response = await POST(
        createRequest(),
        createContext(),
      );

      expect(response.status).toBe(200);

      await expect(
        response.json(),
      ).resolves.toEqual({
        success: true,
      });

      expect(
        mocks.restoreWorkspaceDocument,
      ).toHaveBeenCalledWith({
        tenantId: TenantId,
        actorUserId: UserId,
        documentId: DocumentId,
      });
    });

    it("maps TENANT_FORBIDDEN to 403", async () => {
      mocks.restoreWorkspaceDocument.mockRejectedValue(
        new WorkspaceDocumentRestoreServiceError(
          "TENANT_FORBIDDEN",
          "Forbidden.",
        ),
      );

      const response = await POST(
        createRequest(),
        createContext(),
      );

      expect(response.status).toBe(403);

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: "Forbidden.",
        code: "TENANT_FORBIDDEN",
      });
    });

    it("maps DOCUMENT_NOT_FOUND to 404", async () => {
      mocks.restoreWorkspaceDocument.mockRejectedValue(
        new WorkspaceDocumentRestoreServiceError(
          "DOCUMENT_NOT_FOUND",
          "Not found.",
        ),
      );

      const response = await POST(
        createRequest(),
        createContext(),
      );

      expect(response.status).toBe(404);

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: "Not found.",
        code: "DOCUMENT_NOT_FOUND",
      });
    });

    it("maps DOCUMENT_ALREADY_ACTIVE to 409", async () => {
      mocks.restoreWorkspaceDocument.mockRejectedValue(
        new WorkspaceDocumentRestoreServiceError(
          "DOCUMENT_ALREADY_ACTIVE",
          "Already active.",
        ),
      );

      const response = await POST(
        createRequest(),
        createContext(),
      );

      expect(response.status).toBe(409);

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: "Already active.",
        code: "DOCUMENT_ALREADY_ACTIVE",
      });
    });

    it("returns 403 when the session tenant is missing", async () => {
      configureAuthorizedSession(null);

      const response = await POST(
        createRequest(),
        createContext(),
      );

      expect(response.status).toBe(403);

      expect(
        mocks.getTenantFromSession,
      ).not.toHaveBeenCalled();

      expect(
        mocks.restoreWorkspaceDocument,
      ).not.toHaveBeenCalled();
    });

    it("returns 401 when the actor user ID is missing", async () => {
      configureAuthorizedSession(
        SessionTenantId,
        null,
      );

      const response = await POST(
        createRequest(),
        createContext(),
      );

      expect(response.status).toBe(401);

      expect(
        mocks.restoreWorkspaceDocument,
      ).not.toHaveBeenCalled();
    });

    it("returns 404 when the session tenant cannot be resolved", async () => {
      mocks.getTenantFromSession.mockResolvedValue(
        null,
      );

      const response = await POST(
        createRequest(),
        createContext(),
      );

      expect(response.status).toBe(404);

      expect(
        mocks.restoreWorkspaceDocument,
      ).not.toHaveBeenCalled();
    });
  },
);
