/**
 * Tests for GET /api/cron/sfv-sync
 * SFV-MATCH-SYNC-HOTFIX-01 — Phase B.
 *
 * All external dependencies are mocked. No real database or SFV network
 * access. Verifies the CRON_SECRET authorization guard and that the route
 * delegates to the canonical orchestrator without exposing internals.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockRunAutomaticSfvScheduleSync = vi.fn();

vi.mock("@/lib/integrations/sfv/sync/auto-sync", () => ({
  runAutomaticSfvScheduleSync: mockRunAutomaticSfvScheduleSync,
}));

const { GET } = await import("../route");

const ORIGINAL_ENV = { ...process.env };

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://x/api/cron/sfv-sync", { method: "GET", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/cron/sfv-sync — authorization", () => {
  it("rejects with 401 when CRON_SECRET is not configured (fail closed)", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(makeRequest({ authorization: "Bearer anything" }));

    expect(response.status).toBe(401);
    expect(mockRunAutomaticSfvScheduleSync).not.toHaveBeenCalled();
  });

  it("rejects with 401 when no Authorization header is present", async () => {
    process.env.CRON_SECRET = "test-cron-secret";

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(mockRunAutomaticSfvScheduleSync).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the bearer token does not match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test-cron-secret";

    const response = await GET(makeRequest({ authorization: "Bearer wrong-secret" }));

    expect(response.status).toBe(401);
    expect(mockRunAutomaticSfvScheduleSync).not.toHaveBeenCalled();
  });

  it("rejects a request with no 'Bearer ' prefix even if the raw value matches", async () => {
    process.env.CRON_SECRET = "test-cron-secret";

    const response = await GET(makeRequest({ authorization: "test-cron-secret" }));

    expect(response.status).toBe(401);
  });

  it("accepts a request with the correct Authorization: Bearer <CRON_SECRET> header", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    mockRunAutomaticSfvScheduleSync.mockResolvedValue({
      startedAt: "2026-08-07T10:00:00.000Z",
      finishedAt: "2026-08-07T10:00:01.000Z",
      durationMs: 1000,
      tenantsDiscovered: 1,
      tenantsSynced: 1,
      tenantsSkippedLocked: 0,
      tenantsFailed: 0,
      tenants: [],
    });

    const response = await GET(makeRequest({ authorization: "Bearer test-cron-secret" }));

    expect(response.status).toBe(200);
    expect(mockRunAutomaticSfvScheduleSync).toHaveBeenCalledOnce();
  });
});

describe("GET /api/cron/sfv-sync — response", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });

  it("returns the sanitized summary in the response body", async () => {
    const summary = {
      startedAt: "2026-08-07T10:00:00.000Z",
      finishedAt: "2026-08-07T10:00:02.000Z",
      durationMs: 2000,
      tenantsDiscovered: 2,
      tenantsSynced: 1,
      tenantsSkippedLocked: 1,
      tenantsFailed: 0,
      tenants: [
        { tenantId: "tenant-a", outcome: "synced" },
        { tenantId: "tenant-b", outcome: "skipped_locked" },
      ],
    };
    mockRunAutomaticSfvScheduleSync.mockResolvedValue(summary);

    const response = await GET(makeRequest({ authorization: "Bearer test-cron-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toEqual(summary);
  });

  it("does not expose credentials or secrets in the response", async () => {
    mockRunAutomaticSfvScheduleSync.mockResolvedValue({
      startedAt: "2026-08-07T10:00:00.000Z",
      finishedAt: "2026-08-07T10:00:01.000Z",
      durationMs: 1000,
      tenantsDiscovered: 0,
      tenantsSynced: 0,
      tenantsSkippedLocked: 0,
      tenantsFailed: 0,
      tenants: [],
    });

    const response = await GET(makeRequest({ authorization: "Bearer test-cron-secret" }));
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("test-cron-secret");
    expect(json).not.toContain("Bearer");
    expect(json).not.toContain("SFV_APPLICATION");
  });

  it("returns 500 without leaking internal error details when the orchestrator throws unexpectedly", async () => {
    mockRunAutomaticSfvScheduleSync.mockRejectedValue(new Error("unexpected internal failure with details"));

    const response = await GET(makeRequest({ authorization: "Bearer test-cron-secret" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("unexpected internal failure with details");
  });
});
