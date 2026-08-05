/**
 * Tests for app/api/teams/register/route.ts
 *
 * Covers:
 *   - Unauthenticated request rejection (401)
 *   - Missing permission rejection (403)
 *   - Missing tenant rejection (400)
 *   - Input validation (400)
 *   - Domain errors forwarded from registerTeamSeason
 *   - Successful registration (201)
 *   - Audit log invocation
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getTenantFromSession: vi.fn(),
  registerTeamSeason: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: mocks.getTenantFromSession,
}));

vi.mock("@/lib/teams/team-registration-service", () => ({
  registerTeamSeason: mocks.registerTeamSeason,
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { POST } from "../route";

// ── Helpers ────────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost/api/teams/register";

const TENANT = { id: "tenant-a", key: "fc-test", name: "FC Test", status: "ACTIVE" };

const VALID_BODY = {
  seasonId: "season-01",
  orgUnitIds: ["org-unit-01"],
  team: { name: "Frauen 1" },
  participationType: "TRAINING",
  websiteVisible: true,
  infoboardVisible: true,
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSessionOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: {
      user: { id: "user-01", activeTenantId: "tenant-a", ...overrides },
    },
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mocks.requireApiPermission.mockResolvedValue(makeSessionOk());
  mocks.getTenantFromSession.mockResolvedValue(TENANT);
  mocks.registerTeamSeason.mockResolvedValue({
    ok: true,
    teamId: "new-team-01",
    teamSeasonId: "new-ts-01",
    slug: "frauen-1",
    createdTeamIdentity: true,
  });
  mocks.logAction.mockResolvedValue(undefined);
});

// ── Authentication ─────────────────────────────────────────────────────────────

describe("POST /api/teams/register — authentication", () => {
  it("returns 401 for unauthenticated request", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for missing permission", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "user-02" } },
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });
});

// ── Tenant ─────────────────────────────────────────────────────────────────────

describe("POST /api/teams/register — tenant", () => {
  it("returns 400 when tenant is not found", async () => {
    mocks.getTenantFromSession.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });
});

// ── Input validation ───────────────────────────────────────────────────────────

describe("POST /api/teams/register — input validation", () => {
  it("returns 400 when seasonId is missing", async () => {
    const body = { ...VALID_BODY, seasonId: "" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when orgUnitIds is empty", async () => {
    const body = { ...VALID_BODY, orgUnitIds: [] };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when teamName is missing", async () => {
    const body = { ...VALID_BODY, team: { name: "" } };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid federation mapping (missing externalTeamId)", async () => {
    const body = {
      ...VALID_BODY,
      federationMapping: {
        provider: "SFV",
        // missing externalTeamId and externalSeasonId
      },
    };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when participationType is invalid", async () => {
    const body = { ...VALID_BODY, participationType: "INVALID_TYPE" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("accepts valid participationType COMPETITION", async () => {
    const body = { ...VALID_BODY, participationType: "COMPETITION" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
  });

  it("accepts valid participationType TRAINING", async () => {
    const body = { ...VALID_BODY, participationType: "TRAINING" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
  });

  it("accepts valid participationType DEVELOPMENT", async () => {
    const body = { ...VALID_BODY, participationType: "DEVELOPMENT" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
  });

  it("accepts valid participationType RECREATIONAL", async () => {
    const body = { ...VALID_BODY, participationType: "RECREATIONAL" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
  });

  it("accepts valid participationType OTHER", async () => {
    const body = { ...VALID_BODY, participationType: "OTHER" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
  });

  it("returns 400 when participationType is absent (not defaulted silently)", async () => {
    const body = { ...VALID_BODY };
    // participationType omitted — should fail with 400 (not silently default)
    delete (body as Record<string, unknown>).participationType;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });
});

// ── Domain errors ──────────────────────────────────────────────────────────────

describe("POST /api/teams/register — domain errors", () => {
  it("returns 404 for SEASON_NOT_FOUND", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "SEASON_NOT_FOUND",
      message: "Saison nicht gefunden.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 404 for ORG_UNIT_NOT_FOUND", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "ORG_UNIT_NOT_FOUND",
      message: "OrgUnit nicht gefunden.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 400 for ORG_UNIT_NOT_ACTIVE", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "ORG_UNIT_NOT_ACTIVE",
      message: "OrgUnit ist nicht aktiv.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("returns 403 for ORG_UNIT_TENANT_MISMATCH", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "ORG_UNIT_TENANT_MISMATCH",
      message: "OrgUnit gehört nicht zum Mandanten.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 409 for TEAM_SEASON_ALREADY_EXISTS", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "TEAM_SEASON_ALREADY_EXISTS",
      message: "Dieses Team ist für die ausgewählte Saison bereits registriert.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("returns 409 for SLUG_CONFLICT", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "SLUG_CONFLICT",
      message: "Diese URL wird bereits verwendet.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("returns 409 for FEDERATION_MAPPING_CONFLICT", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "FEDERATION_MAPPING_CONFLICT",
      message: "Verbandsteam bereits zugeordnet.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("returns 400 for TEAM_NAME_REQUIRED", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "TEAM_NAME_REQUIRED",
      message: "Teamname ist erforderlich.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("returns 404 for COMPETITION_NOT_FOUND", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "COMPETITION_NOT_FOUND",
      message: "Wettkampf nicht gefunden.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 403 for COMPETITION_TENANT_MISMATCH", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "COMPETITION_TENANT_MISMATCH",
      message: "Der Wettkampf gehört nicht zum aktiven Mandanten.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 400 for COMPETITION_ARCHIVED", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "COMPETITION_ARCHIVED",
      message: "Archivierte Wettkämpfe können nicht zugeordnet werden.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("returns 400 for COMPETITION_REQUIRED", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "COMPETITION_REQUIRED",
      message: "Wettkampfteams müssen einem Wettkampf zugeordnet werden.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("returns 400 for COMPETITION_NOT_ALLOWED", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: false,
      code: "COMPETITION_NOT_ALLOWED",
      message: "Eine Wettkampfzuordnung ist nur für Wettkampfteams zulässig.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });
});

// ── Successful registration ────────────────────────────────────────────────────

describe("POST /api/teams/register — success", () => {
  it("returns 201 with teamId, teamSeasonId, slug on success", async () => {
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.teamId).toBe("new-team-01");
    expect(body.teamSeasonId).toBe("new-ts-01");
    expect(body.slug).toBe("frauen-1");
    expect(body.createdTeamIdentity).toBe(true);
  });

  it("calls logAction on success", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(mocks.logAction).toHaveBeenCalledOnce();
  });

  it("accepts optional federation mapping", async () => {
    const body = {
      ...VALID_BODY,
      federationMapping: {
        provider: "SFV",
        externalTeamId: 123,
        externalSeasonId: 67,
        providerTeamName: "Test Frauen",
      },
    };

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
  });

  it("accepts existingTeamId for team reuse", async () => {
    mocks.registerTeamSeason.mockResolvedValue({
      ok: true,
      teamId: "existing-team-01",
      teamSeasonId: "new-ts-02",
      slug: "frauen-1",
      createdTeamIdentity: false,
    });

    const body = { ...VALID_BODY, existingTeamId: "existing-team-01" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);

    const result = await res.json();
    expect(result.createdTeamIdentity).toBe(false);
  });

  it("defaults websiteVisible and infoboardVisible to true when absent", async () => {
    const body = {
      seasonId: VALID_BODY.seasonId,
      orgUnitIds: VALID_BODY.orgUnitIds,
      team: VALID_BODY.team,
      participationType: VALID_BODY.participationType,
    };

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);

    expect(mocks.registerTeamSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        websiteVisible: true,
        infoboardVisible: true,
      }),
    );
  });
});
