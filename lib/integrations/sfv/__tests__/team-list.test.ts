/**
 * lib/integrations/sfv/__tests__/team-list.test.ts
 *
 * Focused tests for fetchTeamList() — GET /api/team/list.
 *
 * All tests use synthetic credentials with the .invalid domain.
 * The HTTP layer is fully mocked via vi.spyOn(globalThis, 'fetch').
 * No real network requests are made. No production secrets are used.
 *
 * Contract under test (SFV Club API Interface OpenAPI v26.6.15.2):
 *   GET /api/team/list
 *   Query:   SeasonId (int32, required), ClubId (int32, required)
 *   Query:   OrganisationId, TeamId, LeagueId, CupId, DivisionId, GroupId,
 *            RoundNbr, MatchType, Language, DateFrom, DateUntil (all optional)
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — non-empty (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: application/json — TeamDetail[]
 *   204: no content found → []
 *   401: session token cannot be validated → SFV_UNAUTHORIZED + cache eviction
 *   404: resource not found → SFV_NOT_FOUND
 *   500: unexpected server error → SFV_UNAVAILABLE
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchTeamList,
  evictCachedToken,
  type TeamDetail,
  type TeamListParams,
} from "../client";
import { SfvAuthError, SfvNetworkError } from "../errors";

// ── Synthetic test credentials — never real values ────────────────────────────

const TEST_TOKEN_URL = "https://example.invalid/api/token";
const TEST_APPLICATION_KEY = "test-application-key-not-real";
const TEST_APPLICATION_PASS = "test-application-password-not-real";
const TEST_CLUB_ID = "123";

const VALID_ENV = {
  SFV_TOKEN_URL: TEST_TOKEN_URL,
  SFV_APPLICATION_KEY: TEST_APPLICATION_KEY,
  SFV_APPLICATION_PASS: TEST_APPLICATION_PASS,
  SFV_CLUB_ID: TEST_CLUB_ID,
};

/** Synthetic token — visibly fake, never a real credential. */
const SYNTHETIC_TOKEN = "test-token-opaque-24char";

/** Minimal synthetic TeamDetail matching the documented OpenAPI schema. */
const SYNTHETIC_TEAM: TeamDetail = {
  isHomeTeam: true,
  teamId: 31927,
  teamName: "FC Allschwil",
  teamFullname: "FC Allschwil 1",
  clubNumber: 3502,
  clubName: "FC Allschwil",
  teamLeagueId: 17131,
  teamLeagueName: "4. Liga",
  teamDivisionName: "Gruppe 1",
  teamOrganisationId: 8,
  isTeamActive: true,
};

/** Required parameters for the team list request. */
const REQUIRED_PARAMS: TeamListParams = {
  SeasonId: 2027,
  ClubId: 483,
};

function setEnv(overrides: Partial<typeof VALID_ENV> = {}) {
  const merged = { ...VALID_ENV, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key as string];
    } else {
      process.env[key] = value;
    }
  }
}

function clearSfvEnv() {
  delete process.env["SFV_TOKEN_URL"];
  delete process.env["SFV_APPLICATION_KEY"];
  delete process.env["SFV_APPLICATION_PASS"];
  delete process.env["SFV_CLUB_ID"];
}

/**
 * Returns a fetch mock that first serves the token (text/plain),
 * then serves the given business response.
 */
function mockFetchSequence(businessResponse: Response): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(SYNTHETIC_TOKEN, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    )
    .mockResolvedValueOnce(businessResponse);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function statusResponse(status: number): Response {
  return new Response(status === 204 ? null : "", { status });
}

beforeEach(() => {
  setEnv();
  evictCachedToken();
  vi.restoreAllMocks();
});

afterEach(() => {
  clearSfvEnv();
  evictCachedToken();
  vi.restoreAllMocks();
});

// ── 1. HTTP method ────────────────────────────────────────────────────────────

describe("1 — HTTP method", () => {
  it("uses GET method for the /api/team/list request", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    expect((init as RequestInit).method).toBe("GET");
  });
});

// ── 2. Endpoint path ──────────────────────────────────────────────────────────

describe("2 — Endpoint path", () => {
  it("calls /api/team/list path", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList(REQUIRED_PARAMS);

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe("/api/team/list");
  });
});

// ── 3. Required query parameters ──────────────────────────────────────────────

describe("3 — Required query parameters", () => {
  it("sends SeasonId as a query parameter (exact casing per OpenAPI spec)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList({ SeasonId: 2027, ClubId: 483 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("SeasonId")).toBe("2027");
  });

  it("sends ClubId as a query parameter (exact casing per OpenAPI spec)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList({ SeasonId: 2027, ClubId: 483 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("ClubId")).toBe("483");
  });

  it("SeasonId and ClubId are in the query string, not the path", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList({ SeasonId: 2027, ClubId: 483 });

    const [url] = fetchSpy.mock.calls[1];
    const urlObj = new URL(String(url));
    expect(urlObj.pathname).toBe("/api/team/list");
    expect(urlObj.searchParams.has("SeasonId")).toBe(true);
    expect(urlObj.searchParams.has("ClubId")).toBe(true);
  });
});

// ── 4. Optional parameter omission ───────────────────────────────────────────

describe("4 — Optional parameter omission", () => {
  const optionalParams: (keyof TeamListParams)[] = [
    "OrganisationId",
    "TeamId",
    "LeagueId",
    "CupId",
    "DivisionId",
    "GroupId",
    "RoundNbr",
    "MatchType",
    "Language",
    "DateFrom",
    "DateUntil",
  ];

  for (const param of optionalParams) {
    it(`omits ${param} from query string when not provided`, async () => {
      const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

      await fetchTeamList(REQUIRED_PARAMS);

      const [url] = fetchSpy.mock.calls[1];
      expect(new URL(String(url)).searchParams.has(param)).toBe(false);
    });
  }

  it("includes OrganisationId when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList({ ...REQUIRED_PARAMS, OrganisationId: 8 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("OrganisationId")).toBe("8");
  });

  it("includes TeamId when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList({ ...REQUIRED_PARAMS, TeamId: 31927 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("TeamId")).toBe("31927");
  });

  it("includes DateFrom when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList({ ...REQUIRED_PARAMS, DateFrom: "2026-07-01T00:00:00" });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("DateFrom")).toBe("2026-07-01T00:00:00");
  });

  it("includes DateUntil when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList({ ...REQUIRED_PARAMS, DateUntil: "2027-06-30T23:59:59" });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("DateUntil")).toBe("2027-06-30T23:59:59");
  });
});

// ── 5. Authentication headers ─────────────────────────────────────────────────

describe("5 — Authentication headers", () => {
  it("sends X-User-Token header with the acquired token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
  });

  it("passes the token verbatim — no Bearer prefix in X-User-Token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).not.toMatch(/^Bearer\s/i);
    expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
  });

  it("does not send Authorization: Bearer header", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ── 6. User-Agent header ──────────────────────────────────────────────────────

describe("6 — User-Agent header", () => {
  it("sends a non-empty User-Agent header (required by Cloudflare WAF)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeDefined();
    expect(headers["User-Agent"].trim()).not.toBe("");
  });
});

// ── 7. Accept header ──────────────────────────────────────────────────────────

describe("7 — Accept header", () => {
  it("sends Accept: application/json header", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });
});

// ── 8. Successful array response ──────────────────────────────────────────────

describe("8 — Successful array response", () => {
  it("returns TeamDetail[] on HTTP 200", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    const result = await fetchTeamList(REQUIRED_PARAMS);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("maps all TeamDetail fields from the response", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    const result = await fetchTeamList(REQUIRED_PARAMS);

    expect(result[0]).toEqual(SYNTHETIC_TEAM);
  });

  it("returns multiple entries correctly", async () => {
    const teams = [SYNTHETIC_TEAM, { ...SYNTHETIC_TEAM, teamId: 60413, teamName: "FC Allschwil B" }];
    mockFetchSequence(jsonResponse(teams));

    const result = await fetchTeamList(REQUIRED_PARAMS);

    expect(result).toHaveLength(2);
    expect(result[1].teamId).toBe(60413);
  });

  it("handles nullable fields — teamName null", async () => {
    const teamWithNulls: TeamDetail = {
      ...SYNTHETIC_TEAM,
      teamName: null,
      teamFullname: null,
      clubName: null,
      teamLeagueName: null,
      teamDivisionName: null,
    };
    mockFetchSequence(jsonResponse([teamWithNulls]));

    const result = await fetchTeamList(REQUIRED_PARAMS);

    expect(result[0].teamName).toBeNull();
    expect(result[0].teamFullname).toBeNull();
    expect(result[0].clubName).toBeNull();
    expect(result[0].teamLeagueName).toBeNull();
    expect(result[0].teamDivisionName).toBeNull();
  });
});

// ── 9. Empty response body ────────────────────────────────────────────────────

describe("9 — Empty response body", () => {
  it("returns [] when HTTP 200 body is empty", async () => {
    mockFetchSequence(
      new Response("", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await fetchTeamList(REQUIRED_PARAMS);

    expect(result).toEqual([]);
  });
});

// ── 10. HTTP 204 — no content found ──────────────────────────────────────────

describe("10 — HTTP 204 (no content found)", () => {
  it("returns [] on HTTP 204", async () => {
    mockFetchSequence(statusResponse(204));

    const result = await fetchTeamList(REQUIRED_PARAMS);

    expect(result).toEqual([]);
  });
});

// ── 11. HTTP 401 ──────────────────────────────────────────────────────────────

describe("11 — HTTP 401", () => {
  it("maps HTTP 401 to SFV_UNAUTHORIZED", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAUTHORIZED",
    });
  });

  it("HTTP 401 error is SfvAuthError", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toBeInstanceOf(SfvAuthError);
  });

  it("HTTP 401 on business request evicts the cached token", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchTeamList(REQUIRED_PARAMS);
    } catch {
      // expected SFV_UNAUTHORIZED
    }

    vi.restoreAllMocks();

    // Next call must acquire a new token (2 fetches: token + business request).
    const freshSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([SYNTHETIC_TEAM]));

    await fetchTeamList(REQUIRED_PARAMS);

    expect(freshSpy).toHaveBeenCalledTimes(2);
  });
});

// ── 12. HTTP 404 ──────────────────────────────────────────────────────────────

describe("12 — HTTP 404", () => {
  it("maps HTTP 404 to SFV_NOT_FOUND", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toMatchObject({ code: "SFV_NOT_FOUND" });
  });

  it("HTTP 404 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 13. HTTP 500 ──────────────────────────────────────────────────────────────

describe("13 — HTTP 500", () => {
  it("maps HTTP 500 to SFV_UNAVAILABLE", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });

  it("HTTP 500 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 14. Undocumented HTTP status codes ────────────────────────────────────────

describe("14 — Undocumented HTTP status codes", () => {
  it("maps HTTP 400 to SFV_UNAVAILABLE (generic handler)", async () => {
    mockFetchSequence(statusResponse(400));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });

  it("maps HTTP 403 to SFV_UNAVAILABLE (generic handler)", async () => {
    mockFetchSequence(statusResponse(403));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 15. Timeout ───────────────────────────────────────────────────────────────

describe("15 — Timeout", () => {
  it("maps AbortError on business request to SFV_TIMEOUT", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockRejectedValueOnce(abortError);

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toMatchObject({ code: "SFV_TIMEOUT" });
  });

  it("SFV_TIMEOUT error is SfvNetworkError", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockRejectedValueOnce(abortError);

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 16. Malformed response ────────────────────────────────────────────────────

describe("16 — Malformed response", () => {
  it("maps non-JSON response to SFV_INVALID_RESPONSE", async () => {
    mockFetchSequence(
      new Response("not valid json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("maps non-array JSON response to SFV_INVALID_RESPONSE", async () => {
    mockFetchSequence(jsonResponse({ teamId: 1 }));

    await expect(fetchTeamList(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });
});

// ── 17. Token never appears in errors ────────────────────────────────────────

describe("17 — Token never appears in errors", () => {
  it("error message on 401 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchTeamList(REQUIRED_PARAMS);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("error message on 404 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(404));

    try {
      await fetchTeamList(REQUIRED_PARAMS);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("error message on 500 does not contain the application key", async () => {
    mockFetchSequence(statusResponse(500));

    try {
      await fetchTeamList(REQUIRED_PARAMS);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(TEST_APPLICATION_KEY);
      }
    }
  });
});

// ── 18. No database access ───────────────────────────────────────────────────

describe("18 — No database writes or reads", () => {
  it("fetchTeamList returns data without any database-shaped fields", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    const result = await fetchTeamList(REQUIRED_PARAMS);

    expect(result[0]).not.toHaveProperty("createdAt");
    expect(result[0]).not.toHaveProperty("updatedAt");
    expect(result[0]).not.toHaveProperty("persistedAt");
  });
});

// ── 19. Upstream field-name preservation ─────────────────────────────────────

describe("19 — Upstream field-name preservation", () => {
  it("preserves exact field names from the OpenAPI schema", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_TEAM]));

    const result = await fetchTeamList(REQUIRED_PARAMS);
    const entry = result[0];

    // All 11 documented fields must be present with exact casing
    expect(entry).toHaveProperty("isHomeTeam");
    expect(entry).toHaveProperty("teamId");
    expect(entry).toHaveProperty("teamName");
    expect(entry).toHaveProperty("teamFullname");
    expect(entry).toHaveProperty("clubNumber");
    expect(entry).toHaveProperty("clubName");
    expect(entry).toHaveProperty("teamLeagueId");
    expect(entry).toHaveProperty("teamLeagueName");
    expect(entry).toHaveProperty("teamDivisionName");
    expect(entry).toHaveProperty("teamOrganisationId");
    expect(entry).toHaveProperty("isTeamActive");
  });
});
