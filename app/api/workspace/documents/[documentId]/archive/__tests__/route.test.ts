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
  archiveWorkspaceDocument: vi.fn(),
}));

vi.mock(
  "@/lib/permissions/require-api-permission",
  () => ({
    requireApiPermission: mocks.requireApiPermission,
  }),
);

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: mocks.getTenantFromSession,
}));

vi.mock(
  "@/lib/workspace/document-archive-service",
  () => {
    type ErrorCode =
      | "INVALID_INPUT"
      | "DOCUMENT_NOT_FOUND"
      | "TENANT_FORBIDDEN"
      | "DOCUMENT_ALREADY_ARCHIVED";

    class WorkspaceDocumentArchiveServiceError extends Error {
      readonly code: ErrorCode;

      constructor(code: ErrorCode, message: string) {
        super(message);
        this.name =
          "WorkspaceDocumentArchiveServiceError";
        this.code = code;
      }
    }

    return {
      archiveWorkspaceDocument:
        mocks.archiveWorkspaceDocument,
      WorkspaceDocumentArchiveServiceError,
    };
  },
);

import { PERMISSIONS } from "@/lib/permissions/permissions";
import { POST } from "@/app/api/workspace/documents/[documentId]/archive/route";
import { WorkspaceDocumentArchiveServiceError } from "@/lib/workspace/document-archive-service";

const SESSION_TENANT_ID = "tenant-session";
const TENANT_ID = "tenant-1";
const DOCUMENT_ID = "document-1";
const USER_ID = "user-1";

function mockAuthorizedSession(
  tenantId: string | null = SESSION_TENANT_ID,
  userId: string | null = USER_ID,
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

function makeRequest(): Request {
  return new Request(
    `http://localhost/api/workspace/documents/${DOCUMENT_ID}/archive`,
    {
      method: "POST",
    },
  );
}

function makeParams() {
  return {
    params: Promise.resolve({
      documentId: DOCUMENT_ID,
    }),
  };
}

describe(
  "POST /api/workspace/documents/[documentId]/archive",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mockAuthorizedSession();

      mocks.getTenantFromSession.mockResolvedValue({
        id: TENANT_ID,
        key: "fc-allschwil",
      });

      mocks.archiveWorkspaceDocument.mockResolvedValue({
        documentId: DOCUMENT_ID,
        status: "ARCHIVED",
        archivedAt: new Date(
          "2026-07-19T10:00:00.000Z",
        ),
        updatedByUserId: USER_ID,
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
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "Forbidden",
      });

      expect(
        mocks.requireApiPermission,
      ).toHaveBeenCalledWith(
        PERMISSIONS.WORKSPACE_MANAGE,
      );

      expect(
        mocks.archiveWorkspaceDocument,
      ).not.toHaveBeenCalled();
    });

    it("returns 200 after archiving the document", async () => {
      const response = await POST(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        success: true,
      });

      expect(
        mocks.archiveWorkspaceDocument,
      ).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        documentId: DOCUMENT_ID,
      });
    });

    it.each([
      ["TENANT_FORBIDDEN", 403],
      ["DOCUMENT_NOT_FOUND", 404],
      ["DOCUMENT_ALREADY_ARCHIVED", 409],
    ] as const)(
      "maps %s to HTTP %s",
      async (code, expectedStatus) => {
        mocks.archiveWorkspaceDocument.mockRejectedValue(
          new WorkspaceDocumentArchiveServiceError(
            code,
            "Archive failure.",
          ),
        );

        const response = await POST(
          makeRequest(),
          makeParams(),
        );

        expect(response.status).toBe(expectedStatus);
        await expect(response.json()).resolves.toEqual({
          error: "Archive failure.",
          code,
        });
      },
    );

    it("returns 403 when the session has no tenant", async () => {
      mockAuthorizedSession(null);

      const response = await POST(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(403);

      expect(
        mocks.getTenantFromSession,
      ).not.toHaveBeenCalled();

      expect(
        mocks.archiveWorkspaceDocument,
      ).not.toHaveBeenCalled();
    });

    it("returns 401 when the session has no actor ID", async () => {
      mockAuthorizedSession(
        SESSION_TENANT_ID,
        null,
      );

      const response = await POST(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(401);

      expect(
        mocks.archiveWorkspaceDocument,
      ).not.toHaveBeenCalled();
    });
  },
);
