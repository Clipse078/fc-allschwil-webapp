import { NextRequest } from "next/server";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  listOpponents: vi.fn(),
  createOpponentQueryDatabase: vi.fn(),
}));

vi.mock(
  "@/lib/permissions/require-api-any-permission",
  () => ({
    requireApiAnyPermission: mocks.requireApiAnyPermission,
  }),
);

vi.mock(
  "@/lib/matchcenter/opponents/query-service",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/matchcenter/opponents/query-service")
    >("@/lib/matchcenter/opponents/query-service");

    return {
      ...actual,
      listOpponents: mocks.listOpponents,
    };
  },
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

vi.mock(
  "@/lib/matchcenter/opponents/prisma-query-adapter",
  () => ({
    createOpponentQueryDatabase: mocks.createOpponentQueryDatabase,
  }),
);

import { GET } from "../route";

const BASE_URL = "http://localhost/api/matchcenter/opponents";

function makeRequest(queryString = ""): NextRequest {
  const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
  return new NextRequest(url, { method: "GET" });
}

function makeOpponent(overrides: Record<string, unknown> = {}) {
  return {
    id: "opponent-1",
    tenantId: "tenant-1",
    officialName: "FC Basel 1893",
    shortName: "FC Basel",
    websiteName: "Basel",
    infoboardName: "FCB",
    notes: null,
    archivedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
    externalMappings: [],
    ...overrides,
  };
}

const FAKE_DB = {
  opponent: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
};

describe("GET /api/matchcenter/opponents", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createOpponentQueryDatabase.mockReturnValue(FAKE_DB);

    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: {
        user: {
          id: "user-1",
          activeTenantId: "tenant-1",
        },
      },
    });

    mocks.listOpponents.mockResolvedValue([makeOpponent()]);
  });

  it("returns 401 when not authenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when the user lacks required permissions", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "user-1", activeTenantId: "tenant-1" } },
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("returns 403 when the session has no tenantId", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", activeTenantId: null } },
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Tenant context is required." });
  });

  it("returns 200 with opponents on success", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("opponents");
    expect(Array.isArray(body.opponents)).toBe(true);
  });

  it("calls listOpponents with a narrow database adapter and the session tenantId", async () => {
    await GET(makeRequest());

    expect(mocks.createOpponentQueryDatabase).toHaveBeenCalledOnce();
    expect(mocks.listOpponents).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ tenantId: "tenant-1" }),
    );
  });

  it("passes the search query parameter to listOpponents", async () => {
    await GET(makeRequest("search=Basel"));

    expect(mocks.listOpponents).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ search: "Basel" }),
    );
  });

  it("passes the provider query parameter to listOpponents", async () => {
    await GET(makeRequest("provider=SFV"));

    expect(mocks.listOpponents).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ provider: "SFV" }),
    );
  });

  it("passes the limit query parameter to listOpponents", async () => {
    await GET(makeRequest("limit=25"));

    expect(mocks.listOpponents).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("passes the skip query parameter to listOpponents", async () => {
    await GET(makeRequest("skip=10"));

    expect(mocks.listOpponents).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ skip: 10 }),
    );
  });

  it("passes includeArchived=true when the query param is 'true'", async () => {
    await GET(makeRequest("includeArchived=true"));

    expect(mocks.listOpponents).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ includeArchived: true }),
    );
  });

  it("does not set includeArchived when the query param is absent", async () => {
    await GET(makeRequest());

    expect(mocks.listOpponents).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ includeArchived: false }),
    );
  });

  it("returns 400 when listOpponents throws a validation Error", async () => {
    mocks.listOpponents.mockRejectedValue(
      new Error("Opponent limit must be between 1 and 200."),
    );

    const response = await GET(makeRequest("limit=999"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Opponent limit must be between 1 and 200.",
    });
  });

  it("returns 500 on an unexpected non-Error rejection", async () => {
    mocks.listOpponents.mockRejectedValue("unexpected");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "An unexpected error occurred." });
  });
});
