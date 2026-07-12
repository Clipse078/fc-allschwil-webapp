/**
 * lib/integrations/sfv/__tests__/club-schedule.test.ts
 *
 * Focused tests for fetchClubSchedule() — GET /api/club/schedule.
 *
 * All tests use synthetic credentials with the .invalid domain.
 * The HTTP layer is fully mocked via vi.spyOn(globalThis, 'fetch').
 * No real network requests are made. No production secrets are used.
 *
 * Contract under test (SFV Club API Interface OpenAPI v26.6.15.2):
 *   Tag:     ClubSchedule
 *   GET /api/club/schedule
 *   Query:   SeasonId (int32, required), ClubId (int32, required)
 *   Query:   OrganisationId, TeamId, LeagueId, CupId, DivisionId, GroupId,
 *            RoundNbr, MatchType, Language, DateFrom, DateUntil (all optional)
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — non-empty (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: application/json — Schedule[] (mapped as ClubScheduleEntry[])
 *   401: session token cannot be validated → SFV_UNAUTHORIZED + cache eviction
 *   404: resource not found → SFV_NOT_FOUND
 *   406: resource not available → SFV_NOT_FOUND
 *   500: unexpected server error → SFV_UNAVAILABLE
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchClubSchedule,
  evictCachedToken,
  type ClubScheduleEntry,
  type ClubScheduleParams,
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

/** Minimal synthetic ClubScheduleEntry matching all 31 documented OpenAPI Schedule fields. */
const SYNTHETIC_ENTRY: ClubScheduleEntry = {
  matchId: 100001,
  matchNumber: 1,
  matchDate: "2026-09-05T15:00:00",
  groupId: null,
  cupId: null,
  groupName: null,
  roundNbr: 1,
  playgroundId: 5001,
  stadiumPlaygroundName: "Sportplatz Allschwil",
  isUnkownPlayground: false,
  leagueId: 17131,
  leagueNumber: 4,
  leagueName: "4. Liga Gruppe 1",
  divisionId: 2001,
  divisionName: "Vorrunde",
  organisationId: 8,
  organisationName: "Nordwestschweiz",
  matchType: 1,
  matchTypeName: "Meisterschaft",
  matchState: 1,
  matchStateName: "Geplant",
  playDay: 1,
  playDayName: "1. Spieltag",
  seasonId: 2027,
  seasonName: "2026/2027",
  scoreTeamA: 0,
  scoreTeamB: 0,
  teamAId: 31927,
  teamNameA: "FC Allschwil",
  teamBId: 99001,
  teamNameB: "FC Opponent",
};

/** Required parameters for the club schedule request. */
const REQUIRED_PARAMS: ClubScheduleParams = {
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
  it("uses GET method for the /api/club/schedule request", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    expect((init as RequestInit).method).toBe("GET");
  });
});

// ── 2. Endpoint path ──────────────────────────────────────────────────────────

describe("2 — Endpoint path", () => {
  it("calls /api/club/schedule path", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule(REQUIRED_PARAMS);

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe("/api/club/schedule");
  });
});

// ── 3. Required query parameters ──────────────────────────────────────────────

describe("3 — Required query parameters", () => {
  it("sends SeasonId as a query parameter (exact casing per OpenAPI spec)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule({ SeasonId: 2027, ClubId: 483 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("SeasonId")).toBe("2027");
  });

  it("sends ClubId as a query parameter (exact casing per OpenAPI spec)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule({ SeasonId: 2027, ClubId: 483 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("ClubId")).toBe("483");
  });
});

// ── 4. Optional parameter omission ───────────────────────────────────────────

describe("4 — Optional parameter omission", () => {
  const optionalParams: (keyof ClubScheduleParams)[] = [
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
      const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

      await fetchClubSchedule(REQUIRED_PARAMS);

      const [url] = fetchSpy.mock.calls[1];
      expect(new URL(String(url)).searchParams.has(param)).toBe(false);
    });
  }

  it("includes TeamId when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule({ ...REQUIRED_PARAMS, TeamId: 31927 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("TeamId")).toBe("31927");
  });

  it("includes DateFrom when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule({ ...REQUIRED_PARAMS, DateFrom: "2026-09-01T00:00:00" });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("DateFrom")).toBe("2026-09-01T00:00:00");
  });

  it("includes DateUntil when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule({ ...REQUIRED_PARAMS, DateUntil: "2027-06-30T23:59:59" });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("DateUntil")).toBe("2027-06-30T23:59:59");
  });

  it("includes LeagueId when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule({ ...REQUIRED_PARAMS, LeagueId: 17131 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("LeagueId")).toBe("17131");
  });
});

// ── 5. Authentication headers ─────────────────────────────────────────────────

describe("5 — Authentication headers", () => {
  it("sends X-User-Token header with the acquired token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
  });

  it("passes the token verbatim — no Bearer prefix in X-User-Token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).not.toMatch(/^Bearer\s/i);
    expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
  });

  it("does not send Authorization: Bearer header", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ── 6. User-Agent header ──────────────────────────────────────────────────────

describe("6 — User-Agent header", () => {
  it("sends a non-empty User-Agent header (required by Cloudflare WAF)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeDefined();
    expect(headers["User-Agent"].trim()).not.toBe("");
  });
});

// ── 7. Accept header ──────────────────────────────────────────────────────────

describe("7 — Accept header", () => {
  it("sends Accept: application/json header", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });
});

// ── 8. Successful array response ──────────────────────────────────────────────

describe("8 — Successful array response", () => {
  it("returns ClubScheduleEntry[] on HTTP 200", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubSchedule(REQUIRED_PARAMS);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("maps all 31 ClubScheduleEntry fields from the response", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubSchedule(REQUIRED_PARAMS);

    expect(result[0]).toEqual(SYNTHETIC_ENTRY);
  });

  it("handles nullable fields — groupId and cupId null", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubSchedule(REQUIRED_PARAMS);

    expect(result[0].groupId).toBeNull();
    expect(result[0].cupId).toBeNull();
  });

  it("handles nullable groupId with non-null value", async () => {
    const entryWithGroup: ClubScheduleEntry = { ...SYNTHETIC_ENTRY, groupId: 999, cupId: 888 };
    mockFetchSequence(jsonResponse([entryWithGroup]));

    const result = await fetchClubSchedule(REQUIRED_PARAMS);

    expect(result[0].groupId).toBe(999);
    expect(result[0].cupId).toBe(888);
  });
});

// ── 9. Complete field mapping — all 31 fields ─────────────────────────────────

describe("9 — Complete field mapping (all 31 Schedule schema fields)", () => {
  it("preserves exact field names from the OpenAPI Schedule schema", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubSchedule(REQUIRED_PARAMS);
    const entry = result[0];

    // All 31 documented fields with exact casing
    expect(entry).toHaveProperty("matchId");
    expect(entry).toHaveProperty("matchNumber");
    expect(entry).toHaveProperty("matchDate");
    expect(entry).toHaveProperty("groupId");
    expect(entry).toHaveProperty("cupId");
    expect(entry).toHaveProperty("groupName");
    expect(entry).toHaveProperty("roundNbr");
    expect(entry).toHaveProperty("playgroundId");
    expect(entry).toHaveProperty("stadiumPlaygroundName");
    // Upstream typo preserved: "isUnkownPlayground" (single 'n')
    expect(entry).toHaveProperty("isUnkownPlayground");
    expect(entry).toHaveProperty("leagueId");
    expect(entry).toHaveProperty("leagueNumber");
    expect(entry).toHaveProperty("leagueName");
    expect(entry).toHaveProperty("divisionId");
    expect(entry).toHaveProperty("divisionName");
    expect(entry).toHaveProperty("organisationId");
    expect(entry).toHaveProperty("organisationName");
    expect(entry).toHaveProperty("matchType");
    expect(entry).toHaveProperty("matchTypeName");
    expect(entry).toHaveProperty("matchState");
    expect(entry).toHaveProperty("matchStateName");
    expect(entry).toHaveProperty("playDay");
    expect(entry).toHaveProperty("playDayName");
    expect(entry).toHaveProperty("seasonId");
    expect(entry).toHaveProperty("seasonName");
    expect(entry).toHaveProperty("scoreTeamA");
    expect(entry).toHaveProperty("scoreTeamB");
    expect(entry).toHaveProperty("teamAId");
    expect(entry).toHaveProperty("teamNameA");
    expect(entry).toHaveProperty("teamBId");
    expect(entry).toHaveProperty("teamNameB");
  });

  it("preserves isUnkownPlayground (upstream typo — single 'n') not isUnknownPlayground", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubSchedule(REQUIRED_PARAMS);
    const entry = result[0];

    // Confirm the typo spelling is used, not the corrected spelling
    expect(entry).toHaveProperty("isUnkownPlayground");
    expect(entry).not.toHaveProperty("isUnknownPlayground");
  });

  it("teamAId and teamBId identify home and away teams for image resolution", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubSchedule(REQUIRED_PARAMS);

    expect(result[0].teamAId).toBe(31927);
    expect(result[0].teamBId).toBe(99001);
  });
});

// ── 10. Empty response body ───────────────────────────────────────────────────

describe("10 — Empty response body", () => {
  it("returns [] when HTTP 200 body is empty", async () => {
    mockFetchSequence(
      new Response("", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await fetchClubSchedule(REQUIRED_PARAMS);

    expect(result).toEqual([]);
  });
});

// ── 11. HTTP 401 ──────────────────────────────────────────────────────────────

describe("11 — HTTP 401", () => {
  it("maps HTTP 401 to SFV_UNAUTHORIZED", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAUTHORIZED",
    });
  });

  it("HTTP 401 error is SfvAuthError", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toBeInstanceOf(SfvAuthError);
  });

  it("HTTP 401 on business request evicts the cached token", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchClubSchedule(REQUIRED_PARAMS);
    } catch {
      // expected SFV_UNAUTHORIZED
    }

    vi.restoreAllMocks();

    const freshSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubSchedule(REQUIRED_PARAMS);

    expect(freshSpy).toHaveBeenCalledTimes(2);
  });
});

// ── 12. HTTP 404 ──────────────────────────────────────────────────────────────

describe("12 — HTTP 404", () => {
  it("maps HTTP 404 to SFV_NOT_FOUND", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_NOT_FOUND",
    });
  });
});

// ── 13. HTTP 406 ──────────────────────────────────────────────────────────────

describe("13 — HTTP 406 (resource not available)", () => {
  it("maps HTTP 406 to SFV_NOT_FOUND", async () => {
    mockFetchSequence(statusResponse(406));

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_NOT_FOUND",
    });
  });

  it("HTTP 406 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(406));

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 14. HTTP 500 ──────────────────────────────────────────────────────────────

describe("14 — HTTP 500", () => {
  it("maps HTTP 500 to SFV_UNAVAILABLE", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 15. Undocumented HTTP status codes ────────────────────────────────────────

describe("15 — Undocumented HTTP status codes", () => {
  it("maps HTTP 400 to SFV_UNAVAILABLE (generic handler)", async () => {
    mockFetchSequence(statusResponse(400));

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 16. Timeout ───────────────────────────────────────────────────────────────

describe("16 — Timeout", () => {
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

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_TIMEOUT",
    });
  });
});

// ── 17. Malformed response ────────────────────────────────────────────────────

describe("17 — Malformed response", () => {
  it("maps non-JSON response to SFV_INVALID_RESPONSE", async () => {
    mockFetchSequence(
      new Response("not valid json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("maps non-array JSON to SFV_INVALID_RESPONSE", async () => {
    mockFetchSequence(jsonResponse({ matchId: 1 }));

    await expect(fetchClubSchedule(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });
});

// ── 18. Token never appears in errors ────────────────────────────────────────

describe("18 — Token never appears in errors", () => {
  it("error message on 401 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchClubSchedule(REQUIRED_PARAMS);
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
      await fetchClubSchedule(REQUIRED_PARAMS);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(TEST_APPLICATION_KEY);
      }
    }
  });
});

// ── 19. No database access ───────────────────────────────────────────────────

describe("19 — No database writes or reads", () => {
  it("fetchClubSchedule returns data without any database-shaped fields", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubSchedule(REQUIRED_PARAMS);

    expect(result[0]).not.toHaveProperty("createdAt");
    expect(result[0]).not.toHaveProperty("updatedAt");
    expect(result[0]).not.toHaveProperty("persistedAt");
  });
});
