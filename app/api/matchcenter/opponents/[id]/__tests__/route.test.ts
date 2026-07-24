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
  getOpponentById: vi.fn(),
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
      getOpponentById: mocks.getOpponentById,
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

function makeRequest(id: string): NextRequest {
  return new NextRequest(`${BASE_URL}/${id}`, { method: "GET" });
}

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
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

describe("GET /api/matchcenter/opponents/[id]", () => {
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
          tenantId: "tenant-1",
        },
      },
    });

    mocks.getOpponentById.mockResolvedValue(makeOpponent());
  });

  it("returns 401 when not authenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await GET(
      makeRequest("opponent-1"),
      makeRouteContext("opponent-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when the user lacks required permissions", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "user-1", tenantId: "tenant-1" } },
    });

    const response = await GET(
      makeRequest("opponent-1"),
      makeRouteContext("opponent-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("returns 403 when the session has no tenantId", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", tenantId: null } },
    });

    const response = await GET(
      makeRequest("opponent-1"),
      makeRouteContext("opponent-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Tenant context is required." });
  });

  it("returns 200 with the opponent when found", async () => {
    const response = await GET(
      makeRequest("opponent-1"),
      makeRouteContext("opponent-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("opponent");
    expect(body.opponent.id).toBe("opponent-1");
  });

  it("returns 404 when the opponent is not found", async () => {
    mocks.getOpponentById.mockResolvedValue(null);

    const response = await GET(
      makeRequest("unknown-id"),
      makeRouteContext("unknown-id"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Opponent not found." });
  });

  it("calls getOpponentById with a narrow database adapter and the session tenantId and route id", async () => {
    await GET(makeRequest("opponent-42"), makeRouteContext("opponent-42"));

    expect(mocks.createOpponentQueryDatabase).toHaveBeenCalledOnce();
    expect(mocks.getOpponentById).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ tenantId: "tenant-1", id: "opponent-42" }),
    );
  });

  it("returns 400 when getOpponentById throws a validation Error", async () => {
    mocks.getOpponentById.mockRejectedValue(
      new Error("id is required."),
    );

    const response = await GET(
      makeRequest("   "),
      makeRouteContext("   "),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "id is required." });
  });

  it("returns 500 on an unexpected non-Error rejection", async () => {
    mocks.getOpponentById.mockRejectedValue("unexpected");

    const response = await GET(
      makeRequest("opponent-1"),
      makeRouteContext("opponent-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "An unexpected error occurred." });
  });

  it("enforces tenant isolation by passing tenantId from session, not from request", async () => {
    await GET(makeRequest("opponent-1"), makeRouteContext("opponent-1"));

    expect(mocks.getOpponentById).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ tenantId: "tenant-1" }),
    );
    expect(mocks.getOpponentById).not.toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ tenantId: expect.not.stringContaining("tenant-1") }),
    );
  });

  it("returns the full opponent DTO shape", async () => {
    const response = await GET(
      makeRequest("opponent-1"),
      makeRouteContext("opponent-1"),
    );
    const body = await response.json();

    expect(body.opponent).toMatchObject({
      id: "opponent-1",
      tenantId: "tenant-1",
      officialName: "FC Basel 1893",
      shortName: "FC Basel",
      websiteName: "Basel",
      infoboardName: "FCB",
      notes: null,
      externalMappings: [],
    });
  });
});
