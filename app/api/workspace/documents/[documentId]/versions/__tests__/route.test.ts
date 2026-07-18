import {
  WorkspaceDocumentVersionStatus,
} from "@prisma/client";
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
  getDocumentVersions: vi.fn(),
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
  "@/lib/workspace/document-version-service",
  () => {
    type WorkspaceDocumentVersionServiceErrorCode =
      "INVALID_INPUT";

    class WorkspaceDocumentVersionServiceError
      extends Error {
      readonly code: WorkspaceDocumentVersionServiceErrorCode;

      constructor(
        code: WorkspaceDocumentVersionServiceErrorCode,
        message: string,
      ) {
        super(message);
        this.name =
          "WorkspaceDocumentVersionServiceError";
        this.code = code;
      }
    }

    return {
      WorkspaceDocumentVersionServiceError,
      getDocumentVersions:
        mocks.getDocumentVersions,
    };
  },
);

import { GET } from "@/app/api/workspace/documents/[documentId]/versions/route";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  WorkspaceDocumentVersionServiceError,
} from "@/lib/workspace/document-version-service";

const SESSION_TENANT_ID = "tenant-session";
const TENANT_ID = "tenant-1";
const ACTOR_USER_ID = "user-1";
const DOCUMENT_ID = "document-1";

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

function makeRequest(): Request {
  return new Request(
    `http://localhost/api/workspace/documents/${DOCUMENT_ID}/versions`,
    {
      method: "GET",
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

const versions = [
  {
    id: "version-2",
    versionNumber: 2,
    createdAt: new Date(
      "2026-07-18T12:00:00.000Z",
    ),
    createdByUserId: "user-2",
    createdByName: null,
    filename: "trainer-handbook-v2.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    checksum: "checksum-2",
    status: WorkspaceDocumentVersionStatus.CURRENT,
    isCurrent: true,
  },
  {
    id: "version-1",
    versionNumber: 1,
    createdAt: new Date(
      "2026-07-17T12:00:00.000Z",
    ),
    createdByUserId: ACTOR_USER_ID,
    createdByName: null,
    filename: "trainer-handbook.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    checksum: "checksum-1",
    status:
      WorkspaceDocumentVersionStatus.SUPERSEDED,
    isCurrent: false,
  },
];

describe(
  "GET /api/workspace/documents/[documentId]/versions",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mockAuthorizedSession();

      mocks.getTenantFromSession.mockResolvedValue({
        id: TENANT_ID,
        key: "fc-allschwil",
      });

      mocks.getDocumentVersions.mockResolvedValue(
        versions,
      );
    });

    it("requires WORKSPACE_VIEW before resolving the tenant", async () => {
      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(200);

      expect(
        mocks.requireApiPermission,
      ).toHaveBeenCalledWith(
        PERMISSIONS.WORKSPACE_VIEW,
      );

      expect(
        mocks.requireApiPermission.mock
          .invocationCallOrder[0],
      ).toBeLessThan(
        mocks.getTenantFromSession.mock
          .invocationCallOrder[0],
      );
    });

    it("returns an authorization failure without loading versions", async () => {
      mocks.requireApiPermission.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Forbidden",
        session: null,
      });

      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: "Forbidden",
      });

      expect(
        mocks.getTenantFromSession,
      ).not.toHaveBeenCalled();

      expect(
        mocks.getDocumentVersions,
      ).not.toHaveBeenCalled();
    });

    it("returns 403 when session tenant context is missing", async () => {
      mockAuthorizedSession({
        tenantId: null,
      });

      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: "Kein Mandant in der Sitzung.",
      });

      expect(
        mocks.getDocumentVersions,
      ).not.toHaveBeenCalled();
    });

    it("returns 401 when actor identity is missing", async () => {
      mockAuthorizedSession({
        userId: null,
      });

      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "Benutzer-ID fehlt in der Sitzung.",
      });

      expect(
        mocks.getDocumentVersions,
      ).not.toHaveBeenCalled();
    });

    it("returns 404 when the session tenant cannot be resolved", async () => {
      mocks.getTenantFromSession.mockResolvedValue(
        null,
      );

      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "Tenant nicht gefunden.",
      });

      expect(
        mocks.getDocumentVersions,
      ).not.toHaveBeenCalled();
    });

    it("returns version metadata for the resolved tenant and actor", async () => {
      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(200);

      expect(
        mocks.getDocumentVersions,
      ).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        actorUserId: ACTOR_USER_ID,
        documentId: DOCUMENT_ID,
      });

      expect(await response.json()).toEqual({
        versions: [
          {
            ...versions[0],
            createdAt:
              "2026-07-18T12:00:00.000Z",
          },
          {
            ...versions[1],
            createdAt:
              "2026-07-17T12:00:00.000Z",
          },
        ],
      });
    });

    it("returns 404 when the document is unavailable to the tenant", async () => {
      mocks.getDocumentVersions.mockResolvedValue(
        null,
      );

      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "Dokument nicht gefunden.",
      });
    });

    it("returns an empty version list for an existing document without versions", async () => {
      mocks.getDocumentVersions.mockResolvedValue(
        [],
      );

      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        versions: [],
      });
    });

    it("maps typed input errors to HTTP 400", async () => {
      mocks.getDocumentVersions.mockRejectedValue(
        new WorkspaceDocumentVersionServiceError(
          "INVALID_INPUT",
          "documentId is required.",
        ),
      );

      const response = await GET(
        makeRequest(),
        makeParams(),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "documentId is required.",
        code: "INVALID_INPUT",
      });
    });

    it("returns 500 for an unexpected service failure", async () => {
      const unexpectedError = new Error(
        "Database unavailable",
      );

      mocks.getDocumentVersions.mockRejectedValue(
        unexpectedError,
      );

      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const response = await GET(
          makeRequest(),
          makeParams(),
        );

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
          error:
            "Der Versionsverlauf konnte nicht geladen werden.",
        });

        expect(consoleError).toHaveBeenCalledWith(
          "[workspace-documents] version history failed",
          unexpectedError,
        );
      } finally {
        consoleError.mockRestore();
      }
    });
  },
);