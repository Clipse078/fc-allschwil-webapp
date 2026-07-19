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
  listFolders: vi.fn(),
  createFolder: vi.fn(),
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

vi.mock("@/lib/workspace/folder-service", () => {
  type WorkspaceFolderServiceErrorCode =
    | "INVALID_INPUT"
    | "PARENT_FOLDER_NOT_FOUND"
    | "WORKSPACE_FOLDER_NAME_CONFLICT";

  class WorkspaceFolderServiceError extends Error {
    readonly code: WorkspaceFolderServiceErrorCode;

    constructor(
      code: WorkspaceFolderServiceErrorCode,
      message: string,
    ) {
      super(message);
      this.name = "WorkspaceFolderServiceError";
      this.code = code;
    }
  }

  return {
    WorkspaceFolderServiceError,
    listWorkspaceFolders: mocks.listFolders,
    createWorkspaceFolder: mocks.createFolder,
  };
});

import {
  GET,
  POST,
} from "@/app/api/workspace/folders/route";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  WorkspaceFolderServiceError,
} from "@/lib/workspace/folder-service";

const SESSION_TENANT_ID = "tenant-session";
const TENANT_ID = "tenant-1";
const ACTOR_USER_ID = "user-1";

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

function makeGetRequest(
  parentId?: string,
): NextRequest {
  const url = new URL(
    "http://localhost/api/workspace/folders",
  );

  if (parentId !== undefined) {
    url.searchParams.set("parentId", parentId);
  }

  return new NextRequest(url, {
    method: "GET",
  });
}

function makePostRequest(
  body: unknown,
): NextRequest {
  return new NextRequest(
    "http://localhost/api/workspace/folders",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

const listedFolders = [
  {
    id: "folder-1",
    parentId: null,
    name: "Trainer",
    description: "Interne Trainerdokumente",
    displayOrder: 10,
    createdByUserId: ACTOR_USER_ID,
    updatedByUserId: ACTOR_USER_ID,
    archivedAt: null,
    createdAt: new Date("2026-07-17T10:00:00.000Z"),
    updatedAt: new Date("2026-07-17T10:05:00.000Z"),
  },
];

const createdFolder = {
  id: "folder-2",
  parentId: "folder-1",
  name: "Handbuecher",
  description: "Trainerhandbuecher",
  displayOrder: 20,
  createdByUserId: ACTOR_USER_ID,
  updatedByUserId: ACTOR_USER_ID,
  archivedAt: null,
  createdAt: new Date("2026-07-17T11:00:00.000Z"),
  updatedAt: new Date("2026-07-17T11:00:00.000Z"),
};

describe("GET /api/workspace/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthorizedSession();

    mocks.getTenantFromSession.mockResolvedValue({
      id: TENANT_ID,
      key: "fc-allschwil",
    });

    mocks.listFolders.mockResolvedValue(
      listedFolders,
    );
  });

  it("checks WORKSPACE_VIEW before resolving the tenant", async () => {
    const response = await GET(makeGetRequest());

    expect(response.status).toBe(200);

    expect(
      mocks.requireApiPermission,
    ).toHaveBeenCalledWith(
      PERMISSIONS.WORKSPACE_VIEW,
    );

    expect(
      mocks.requireApiPermission.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.getTenantFromSession.mock.invocationCallOrder[0],
    );
  });

  it("returns an authorization failure without resolving the tenant", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden",
    });

    expect(
      mocks.getTenantFromSession,
    ).not.toHaveBeenCalled();

    expect(
      mocks.listFolders,
    ).not.toHaveBeenCalled();
  });

  it("returns 403 when tenant context is missing", async () => {
    mockAuthorizedSession({
      tenantId: null,
    });

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Kein Mandant in der Sitzung.",
    });

    expect(
      mocks.getTenantFromSession,
    ).not.toHaveBeenCalled();
  });

  it("returns 404 when the tenant cannot be resolved", async () => {
    mocks.getTenantFromSession.mockResolvedValue(null);

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Tenant nicht gefunden.",
    });

    expect(
      mocks.listFolders,
    ).not.toHaveBeenCalled();
  });

  it("lists root folders using the resolved tenant", async () => {
    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);

    expect(
      mocks.listFolders,
    ).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      parentId: null,
    });

    expect(body).toEqual({
      folders: [
        {
          ...listedFolders[0],
          archivedAt: null,
          createdAt:
            "2026-07-17T10:00:00.000Z",
          updatedAt:
            "2026-07-17T10:05:00.000Z",
        },
      ],
    });
  });

  it("trims and forwards a parent folder ID", async () => {
    const response = await GET(
      makeGetRequest("  folder-1  "),
    );

    expect(response.status).toBe(200);

    expect(
      mocks.listFolders,
    ).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      parentId: "folder-1",
    });
  });

  it("normalizes a blank parent ID to the root", async () => {
    const response = await GET(
      makeGetRequest("   "),
    );

    expect(response.status).toBe(200);

    expect(
      mocks.listFolders,
    ).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      parentId: null,
    });
  });

  it.each([
    ["INVALID_INPUT", 400],
    ["PARENT_FOLDER_NOT_FOUND", 404],
    ["WORKSPACE_FOLDER_NAME_CONFLICT", 409],
  ] as const)(
    "maps %s listing errors to HTTP %i",
    async (code, expectedStatus) => {
      mocks.listFolders.mockRejectedValue(
        new WorkspaceFolderServiceError(
          code,
          `Listing failed: ${code}`,
        ),
      );

      const response = await GET(
        makeGetRequest("folder-1"),
      );

      expect(response.status).toBe(
        expectedStatus,
      );

      expect(await response.json()).toEqual({
        error: `Listing failed: ${code}`,
        code,
      });
    },
  );

  it("returns 500 for an unexpected listing failure", async () => {
    const unexpectedError = new Error(
      "Database unavailable",
    );

    mocks.listFolders.mockRejectedValue(
      unexpectedError,
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await GET(
        makeGetRequest(),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error:
          "Die Ordner konnten nicht geladen werden.",
      });

      expect(consoleError).toHaveBeenCalledWith(
        "[workspace-folders] folder listing failed",
        unexpectedError,
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("POST /api/workspace/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthorizedSession();

    mocks.getTenantFromSession.mockResolvedValue({
      id: TENANT_ID,
      key: "fc-allschwil",
    });

    mocks.createFolder.mockResolvedValue(
      createdFolder,
    );
  });

  it("checks WORKSPACE_MANAGE before parsing JSON", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const json = vi.fn();

    const response = await POST({
      json,
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

    expect(json).not.toHaveBeenCalled();

    expect(
      mocks.getTenantFromSession,
    ).not.toHaveBeenCalled();

    expect(
      mocks.createFolder,
    ).not.toHaveBeenCalled();
  });

  it("returns 403 when tenant context is missing", async () => {
    mockAuthorizedSession({
      tenantId: null,
    });

    const response = await POST(
      makePostRequest({
        name: "Trainer",
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Kein Mandant in der Sitzung.",
    });

    expect(
      mocks.createFolder,
    ).not.toHaveBeenCalled();
  });

  it("returns 401 when actor user ID is missing", async () => {
    mockAuthorizedSession({
      userId: null,
    });

    const response = await POST(
      makePostRequest({
        name: "Trainer",
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Benutzer-ID fehlt in der Sitzung.",
    });

    expect(
      mocks.createFolder,
    ).not.toHaveBeenCalled();
  });

  it("returns 404 when the tenant cannot be resolved", async () => {
    mocks.getTenantFromSession.mockResolvedValue(null);

    const response = await POST(
      makePostRequest({
        name: "Trainer",
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Tenant nicht gefunden.",
    });

    expect(
      mocks.createFolder,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const request = new NextRequest(
      "http://localhost/api/workspace/folders",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{invalid-json",
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Ungueltige Anfrage: JSON erwartet.",
    });

    expect(
      mocks.createFolder,
    ).not.toHaveBeenCalled();
  });

  it.each([
    [null],
    [[]],
    ["folder"],
    [123],
  ])(
    "returns 400 when the JSON body is not an object: %j",
    async (body) => {
      const response = await POST(
        makePostRequest(body),
      );

      expect(response.status).toBe(400);

      expect(await response.json()).toEqual({
        error:
          "Ungueltige Anfrage: JSON-Objekt erwartet.",
        code: "INVALID_INPUT",
      });

      expect(
        mocks.createFolder,
      ).not.toHaveBeenCalled();
    },
  );

  it("returns 400 when name is missing", async () => {
    const response = await POST(
      makePostRequest({
        description: "Missing name",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "name muss eine Zeichenkette sein.",
      code: "INVALID_INPUT",
    });

    expect(
      mocks.createFolder,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 when displayOrder is not numeric", async () => {
    const response = await POST(
      makePostRequest({
        name: "Trainer",
        displayOrder: "10",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "displayOrder muss eine Zahl sein.",
      code: "INVALID_INPUT",
    });

    expect(
      mocks.createFolder,
    ).not.toHaveBeenCalled();
  });

  it("creates a folder using only session-controlled identity", async () => {
    const response = await POST(
      makePostRequest({
        parentId: "  folder-1  ",
        name: "  Handbuecher  ",
        description: "  Trainerhandbuecher  ",
        displayOrder: 20,
        tenantId: "attacker-tenant",
        actorUserId: "attacker-user",
      }),
    );

    expect(response.status).toBe(201);

    expect(
      mocks.getTenantFromSession,
    ).toHaveBeenCalledWith(
      SESSION_TENANT_ID,
    );

    expect(
      mocks.createFolder,
    ).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      parentId: "  folder-1  ",
      name: "  Handbuecher  ",
      description: "  Trainerhandbuecher  ",
      displayOrder: 20,
      actorUserId: ACTOR_USER_ID,
    });

    expect(await response.json()).toEqual({
      folder: {
        ...createdFolder,
        archivedAt: null,
        createdAt:
          "2026-07-17T11:00:00.000Z",
        updatedAt:
          "2026-07-17T11:00:00.000Z",
      },
    });
  });

  it.each([
    ["INVALID_INPUT", 400],
    ["PARENT_FOLDER_NOT_FOUND", 404],
    ["WORKSPACE_FOLDER_NAME_CONFLICT", 409],
  ] as const)(
    "maps %s creation errors to HTTP %i",
    async (code, expectedStatus) => {
      mocks.createFolder.mockRejectedValue(
        new WorkspaceFolderServiceError(
          code,
          `Creation failed: ${code}`,
        ),
      );

      const response = await POST(
        makePostRequest({
          name: "Trainer",
        }),
      );

      expect(response.status).toBe(
        expectedStatus,
      );

      expect(await response.json()).toEqual({
        error: `Creation failed: ${code}`,
        code,
      });
    },
  );

  it("returns 500 for an unexpected creation failure", async () => {
    const unexpectedError = new Error(
      "Database unavailable",
    );

    mocks.createFolder.mockRejectedValue(
      unexpectedError,
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await POST(
        makePostRequest({
          name: "Trainer",
        }),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error:
          "Der Ordner konnte nicht erstellt werden.",
      });

      expect(consoleError).toHaveBeenCalledWith(
        "[workspace-folders] folder creation failed",
        unexpectedError,
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});