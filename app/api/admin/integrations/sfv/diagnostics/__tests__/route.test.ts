/**
 * Tests for POST /api/admin/integrations/sfv/diagnostics
 *
 * Covers: authentication, authorization, request validation, service invocation,
 * HTTP status mapping, response shape, response safety, unexpected failures, and
 * method surface.
 *
 * All external dependencies are mocked. No real network requests. No real credentials.
 * No real database access. No hard-coded production clubId/seasonId in route logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SfvAdminDiagnostics, SfvDiagnosticIssue } from "@/lib/integrations/sfv/admin-diagnostics-service";

// ── Mock external dependencies before importing the route ─────────────────────

const mockRequireApiPermission = vi.fn();
const mockRunSfvAdminDiagnostics = vi.fn();

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/lib/integrations/sfv/admin-diagnostics-service", () => ({
  runSfvAdminDiagnostics: mockRunSfvAdminDiagnostics,
}));

// Import after mocks
const { POST } = await import("../route");

// ── Request factory helpers ───────────────────────────────────────────────────

const ROUTE_URL = "http://localhost/api/admin/integrations/sfv/diagnostics";

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

function makeEmptyRequest(): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
  });
}

// ── Auth fixture helpers ──────────────────────────────────────────────────────

const AUTHENTICATED_ADMIN = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      email: "admin@test.invalid",
      tenantId: "tenant-1",
    },
  },
};

const UNAUTHENTICATED = {
  ok: false as const,
  status: 401,
  error: "Unauthorized",
  session: null,
};

const FORBIDDEN = {
  ok: false as const,
  status: 403,
  error: "Forbidden",
  session: { user: { id: "user-2", email: "nonadmin@test.invalid" } },
};

// ── Diagnostics fixture helpers ───────────────────────────────────────────────

const BASE_COUNTS = {
  ownTeams: 11,
  scheduleRows: 60,
  rankingRows: 26,
  resolvedScheduleRows: 58,
  scheduleBothOwnRows: 0,
  scheduleNoOwnTeamRows: 0,
  scheduleInvalidRows: 0,
  scheduleFailedRows: 0,
  rankingOwnTeamRows: 11,
  rankingOpponentRows: 15,
  rankingInvalidRows: 0,
  rankingFailedRows: 0,
  uniqueOpponentTeams: 43,
  picturesRequested: 43,
  picturesPresent: 43,
  picturesMissing: 0,
  pictureFailures: 0,
};

const BASE_TIMINGS = [
  { stage: "resolve-common-ids" as const, durationMs: 120, success: true },
  { stage: "load-club-season-data" as const, durationMs: 880, success: true },
];

function makeHealthyDiagnostics(clubId = 1, seasonId = 1): SfvAdminDiagnostics {
  return {
    health: "healthy",
    clubId,
    seasonId,
    seasonName: "2026/2027",
    seasonShortName: "26/27",
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 1000,
    timings: BASE_TIMINGS,
    counts: BASE_COUNTS,
    issues: [],
  };
}

function makeDegradedDiagnostics(clubId = 1, seasonId = 1): SfvAdminDiagnostics {
  const degradedIssue: SfvDiagnosticIssue = {
    severity: "warning",
    code: "SFV_SCHEDULE_NO_OWN_TEAM",
    message: "2 schedule row(s) matched neither team as an own team.",
    count: 2,
  };
  return {
    health: "degraded",
    clubId,
    seasonId,
    seasonName: "2026/2027",
    seasonShortName: "26/27",
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 1000,
    timings: BASE_TIMINGS,
    counts: { ...BASE_COUNTS, scheduleNoOwnTeamRows: 2 },
    issues: [degradedIssue],
  };
}

function makeUnhealthyRetryableDiagnostics(clubId = 1, seasonId = 1): SfvAdminDiagnostics {
  const retryableIssue: SfvDiagnosticIssue = {
    severity: "error",
    code: "SFV_TIMEOUT",
    message: "The SFV API request timed out.",
    retryable: true,
  };
  return {
    health: "unhealthy",
    clubId,
    seasonId,
    seasonName: null,
    seasonShortName: null,
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 30000,
    timings: [{ stage: "resolve-common-ids", durationMs: 30000, success: false }],
    counts: {
      ownTeams: 0,
      scheduleRows: 0,
      rankingRows: 0,
      resolvedScheduleRows: 0,
      scheduleBothOwnRows: 0,
      scheduleNoOwnTeamRows: 0,
      scheduleInvalidRows: 0,
      scheduleFailedRows: 0,
      rankingOwnTeamRows: 0,
      rankingOpponentRows: 0,
      rankingInvalidRows: 0,
      rankingFailedRows: 0,
      uniqueOpponentTeams: 0,
      picturesRequested: 0,
      picturesPresent: 0,
      picturesMissing: 0,
      pictureFailures: 0,
    },
    issues: [retryableIssue],
  };
}

function makeUnhealthyNonRetryableDiagnostics(clubId = 1, seasonId = 1): SfvAdminDiagnostics {
  const nonRetryableIssue: SfvDiagnosticIssue = {
    severity: "error",
    code: "SFV_AUTH_FAILURE",
    message: "SFV authentication failed.",
    retryable: false,
  };
  return {
    health: "unhealthy",
    clubId,
    seasonId,
    seasonName: null,
    seasonShortName: null,
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 200,
    timings: [{ stage: "resolve-common-ids", durationMs: 200, success: false }],
    counts: {
      ownTeams: 0,
      scheduleRows: 0,
      rankingRows: 0,
      resolvedScheduleRows: 0,
      scheduleBothOwnRows: 0,
      scheduleNoOwnTeamRows: 0,
      scheduleInvalidRows: 0,
      scheduleFailedRows: 0,
      rankingOwnTeamRows: 0,
      rankingOpponentRows: 0,
      rankingInvalidRows: 0,
      rankingFailedRows: 0,
      uniqueOpponentTeams: 0,
      picturesRequested: 0,
      picturesPresent: 0,
      picturesMissing: 0,
      pictureFailures: 0,
    },
    issues: [nonRetryableIssue],
  };
}

function makeUnhealthyMixedDiagnostics(clubId = 1, seasonId = 1): SfvAdminDiagnostics {
  const nonRetryableIssue: SfvDiagnosticIssue = {
    severity: "error",
    code: "SFV_AUTH_FAILURE",
    message: "SFV authentication failed.",
    retryable: false,
  };
  const retryableIssue: SfvDiagnosticIssue = {
    severity: "error",
    code: "SFV_TIMEOUT",
    message: "The SFV API request timed out.",
    retryable: true,
  };
  return {
    health: "unhealthy",
    clubId,
    seasonId,
    seasonName: null,
    seasonShortName: null,
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 500,
    timings: [{ stage: "resolve-common-ids", durationMs: 500, success: false }],
    counts: {
      ownTeams: 0,
      scheduleRows: 0,
      rankingRows: 0,
      resolvedScheduleRows: 0,
      scheduleBothOwnRows: 0,
      scheduleNoOwnTeamRows: 0,
      scheduleInvalidRows: 0,
      scheduleFailedRows: 0,
      rankingOwnTeamRows: 0,
      rankingOpponentRows: 0,
      rankingInvalidRows: 0,
      rankingFailedRows: 0,
      uniqueOpponentTeams: 0,
      picturesRequested: 0,
      picturesPresent: 0,
      picturesMissing: 0,
      pictureFailures: 0,
    },
    issues: [nonRetryableIssue, retryableIssue],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
  mockRunSfvAdminDiagnostics.mockResolvedValue(makeHealthyDiagnostics());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/admin/integrations/sfv/diagnostics", () => {
  // ── Authentication and authorization ────────────────────────────────────────

  it("1. rejects unauthenticated request with 401", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("2. rejects unauthorized request with 403", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("3. does not call runSfvAdminDiagnostics when auth fails (unauthenticated)", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("3b. does not call runSfvAdminDiagnostics when auth fails (forbidden)", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("4. authorized request proceeds to diagnostics call", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(200);
    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledOnce();
  });

  it("5. calls requireApiPermission with TENANTS_MANAGE", async () => {
    await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(mockRequireApiPermission).toHaveBeenCalledWith("tenants.manage");
  });

  // ── Request validation ──────────────────────────────────────────────────────

  it("6. rejects malformed JSON with 400", async () => {
    const response = await POST(makeRawRequest("{invalid-json"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("7. rejects empty body with 400", async () => {
    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("8. rejects JSON null body with 400", async () => {
    const response = await POST(makeRawRequest("null"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("9. rejects JSON array body with 400", async () => {
    const response = await POST(makeJsonRequest([{ clubId: 1, seasonId: 1 }]));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("10. rejects body missing clubId with 400", async () => {
    const response = await POST(makeJsonRequest({ seasonId: 1 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("11. rejects body missing seasonId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("12. rejects clubId=0 with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 0, seasonId: 1 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("13. rejects negative clubId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: -1, seasonId: 1 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("14. rejects fractional clubId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1.5, seasonId: 1 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("15. rejects string clubId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: "483", seasonId: 1 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("16. rejects seasonId=0 with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 0 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("17. rejects negative seasonId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: -2027 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("18. rejects fractional seasonId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 2027.5 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("19. rejects string seasonId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: "2027" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("20. accepts valid positive integer clubId and seasonId", async () => {
    const response = await POST(makeJsonRequest({ clubId: 100, seasonId: 2025 }));

    expect(response.status).toBe(200);
  });

  it("20b. ignores unknown fields in body", async () => {
    const response = await POST(
      makeJsonRequest({ clubId: 1, seasonId: 1, unknown: "ignored", extra: 99 }),
    );

    expect(response.status).toBe(200);
  });

  it("20c. rejects NaN-equivalent (Infinity is not an integer)", async () => {
    const response = await POST(makeRawRequest('{"clubId":1e999,"seasonId":1}'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ── Service invocation ──────────────────────────────────────────────────────

  it("21. calls runSfvAdminDiagnostics exactly once per request", async () => {
    await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledOnce();
  });

  it("22. calls runSfvAdminDiagnostics with exact clubId and seasonId from request", async () => {
    await POST(makeJsonRequest({ clubId: 42, seasonId: 9999 }));

    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith({ clubId: 42, seasonId: 9999 });
  });

  it("22b. passes different clubId and seasonId correctly (not hard-coded)", async () => {
    await POST(makeJsonRequest({ clubId: 7, seasonId: 2028 }));

    const callArg = mockRunSfvAdminDiagnostics.mock.calls[0][0];
    expect(callArg.clubId).toBe(7);
    expect(callArg.seasonId).toBe(2028);
  });

  it("23. does not call runSfvAdminDiagnostics when validation fails", async () => {
    await POST(makeJsonRequest({ clubId: -1, seasonId: 1 }));

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("24. does not call runSfvAdminDiagnostics a second time (no duplicate calls)", async () => {
    await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledTimes(1);
  });

  // ── HTTP status mapping ─────────────────────────────────────────────────────

  it("25. healthy diagnostics → 200", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeHealthyDiagnostics());

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(200);
  });

  it("26. degraded diagnostics → 200", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeDegradedDiagnostics());

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(200);
  });

  it("27. unhealthy with only retryable issue → 503", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeUnhealthyRetryableDiagnostics());

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(503);
  });

  it("28. unhealthy with only non-retryable issue → 502", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeUnhealthyNonRetryableDiagnostics());

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(502);
  });

  it("29. unhealthy with mixed issues (any retryable) → 503", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeUnhealthyMixedDiagnostics());

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(503);
  });

  // ── Response shape and content ──────────────────────────────────────────────

  it("30. healthy diagnostics returned in response envelope", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body).toHaveProperty("diagnostics");
    expect(body.diagnostics.health).toBe("healthy");
    expect(body.diagnostics.clubId).toBe(diag.clubId);
    expect(body.diagnostics.seasonId).toBe(diag.seasonId);
  });

  it("31. degraded diagnostics returned in response envelope", async () => {
    const diag = makeDegradedDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.diagnostics.health).toBe("degraded");
    expect(body.diagnostics.issues).toHaveLength(1);
  });

  it("32. unhealthy diagnostics returned in response envelope (non-retryable)", async () => {
    const diag = makeUnhealthyNonRetryableDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.diagnostics.health).toBe("unhealthy");
    expect(body.diagnostics.issues).toHaveLength(1);
  });

  it("33. successful response has Content-Type application/json", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    const ct = response.headers.get("content-type");
    expect(ct).toContain("application/json");
  });

  it("34. response contains no base64-like values", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const json = JSON.stringify(await response.json());

    // Detects a base64 blob longer than 100 chars (image data signature)
    expect(json).not.toMatch(/[A-Za-z0-9+/]{100,}={0,2}/);
  });

  it("35. response contains no token-like fields", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const json = JSON.stringify(await response.json());

    expect(json).not.toMatch(/bearer/i);
    expect(json).not.toMatch(/authorization/i);
    expect(json).not.toContain("access_token");
    expect(json).not.toContain("applicationKey");
    expect(json).not.toContain("applicationPass");
  });

  it("36. response contains no stack trace material", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("at Object");
    expect(json).not.toContain("at async");
    expect(json).not.toContain(".ts:");
    expect(json).not.toContain("Error:");
  });

  it("37. issue codes are preserved in response", async () => {
    const diag = makeDegradedDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.diagnostics.issues[0].code).toBe("SFV_SCHEDULE_NO_OWN_TEAM");
  });

  it("38. counts are preserved in response", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.diagnostics.counts.ownTeams).toBe(11);
    expect(body.diagnostics.counts.scheduleRows).toBe(60);
    expect(body.diagnostics.counts.rankingRows).toBe(26);
    expect(body.diagnostics.counts.picturesPresent).toBe(43);
    expect(body.diagnostics.counts.picturesMissing).toBe(0);
    expect(body.diagnostics.counts.pictureFailures).toBe(0);
  });

  it("39. timings are preserved in response", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.diagnostics.timings).toHaveLength(2);
    expect(body.diagnostics.timings[0].stage).toBe("resolve-common-ids");
    expect(body.diagnostics.timings[1].stage).toBe("load-club-season-data");
    expect(typeof body.diagnostics.timings[0].durationMs).toBe("number");
  });

  it("39b. totalDurationMs is preserved in response", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(typeof body.diagnostics.totalDurationMs).toBe("number");
    expect(body.diagnostics.totalDurationMs).toBe(1000);
  });

  it("39c. generatedAt timestamp is preserved in response", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.diagnostics.generatedAt).toBe("2026-07-12T10:00:00.000Z");
  });

  // ── Unexpected service failures ─────────────────────────────────────────────

  it("40. service throws unexpected Error → 500 response", async () => {
    mockRunSfvAdminDiagnostics.mockRejectedValue(new Error("Unexpected internal error"));

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(500);
  });

  it("41. 500 response contains generic error message (no internal details)", async () => {
    mockRunSfvAdminDiagnostics.mockRejectedValue(new Error("Unexpected internal error"));

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("Unexpected internal error");
  });

  it("42. 500 response contains no stack trace", async () => {
    mockRunSfvAdminDiagnostics.mockRejectedValue(
      Object.assign(new Error("Boom"), { stack: "Error: Boom\n    at route.ts:99" }),
    );

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("route.ts:99");
    expect(json).not.toContain("at route");
    expect(json).not.toContain("Boom");
  });

  it("43. unexpected error response has content-type application/json", async () => {
    mockRunSfvAdminDiagnostics.mockRejectedValue(new Error("Unexpected"));

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    const ct = response.headers.get("content-type");
    expect(ct).toContain("application/json");
  });

  // ── Method surface ──────────────────────────────────────────────────────────

  it("45. POST handler is exported from the route module", () => {
    expect(typeof POST).toBe("function");
  });

  // ── Tenant-safety: no hard-coded IDs ─────────────────────────────────────────

  it("47. route does not hard-code ClubId=483 — accepts a different clubId", async () => {
    await POST(makeJsonRequest({ clubId: 9999, seasonId: 1 }));

    const callArg = mockRunSfvAdminDiagnostics.mock.calls[0][0];
    // Passes through whatever clubId was in the body, not 483
    expect(callArg.clubId).toBe(9999);
    expect(callArg.clubId).not.toBe(483);
  });

  it("48. route does not hard-code SeasonId=2027 — accepts a different seasonId", async () => {
    await POST(makeJsonRequest({ clubId: 1, seasonId: 1000 }));

    const callArg = mockRunSfvAdminDiagnostics.mock.calls[0][0];
    expect(callArg.seasonId).toBe(1000);
    expect(callArg.seasonId).not.toBe(2027);
  });

  // ── Additional edge cases ────────────────────────────────────────────────────

  it("validation fails before auth for malformed JSON (auth checked first, then body)", async () => {
    // Auth passes; body is malformed. Result should be 400 not a service error.
    const response = await POST(makeRawRequest("not-json-at-all"));

    expect(response.status).toBe(400);
    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("unhealthy with no retryable issues (empty retryable fields) → 502", async () => {
    const diag: SfvAdminDiagnostics = {
      ...makeUnhealthyNonRetryableDiagnostics(),
      issues: [
        { severity: "error", code: "SFV_SERVER_FAILURE", message: "Invalid response." },
      ],
    };
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(502);
  });

  it("unhealthy with retryable=false explicitly → 502", async () => {
    const diag: SfvAdminDiagnostics = {
      ...makeUnhealthyNonRetryableDiagnostics(),
      issues: [
        {
          severity: "error",
          code: "SFV_AUTH_FAILURE",
          message: "Auth failed.",
          retryable: false,
        },
      ],
    };
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(502);
  });

  it("both clubId and seasonId as 1 are valid (boundary test: positive minimum)", async () => {
    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));

    expect(response.status).toBe(200);
    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith({ clubId: 1, seasonId: 1 });
  });

  it("large valid clubId and seasonId are accepted", async () => {
    const response = await POST(makeJsonRequest({ clubId: 999999, seasonId: 9999 }));

    expect(response.status).toBe(200);
    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith({
      clubId: 999999,
      seasonId: 9999,
    });
  });

  it("issue count field is preserved in degraded diagnostics", async () => {
    const diag = makeDegradedDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.diagnostics.issues[0].count).toBe(2);
  });

  it("seasonName and seasonShortName are preserved in response", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeJsonRequest({ clubId: 1, seasonId: 1 }));
    const body = await response.json();

    expect(body.diagnostics.seasonName).toBe("2026/2027");
    expect(body.diagnostics.seasonShortName).toBe("26/27");
  });
});
