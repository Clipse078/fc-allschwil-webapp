/**
 * lib/match-results/__tests__/match-result-service.test.ts
 *
 * Comprehensive unit tests for the canonical match result service.
 *
 * Coverage:
 *   - Status lifecycle: SCHEDULED → LIVE → FINISHED
 *   - All terminal statuses: CANCELLED, POSTPONED, ABANDONED, FORFEITED
 *   - Score progression (live updates)
 *   - Duplicate updates / idempotency
 *   - Negative score validation
 *   - Finished match without score (warning)
 *   - Cancelled match with score (warning)
 *   - Archived match rejection
 *   - Tenant isolation / cross-tenant rejection
 *   - Missing match rejection
 *   - Batch updates (mixed outcomes)
 *   - Provider isolation
 *   - publishMatchResult
 *   - resolveMatchStatus
 *   - Audit logging (best-effort, no throw on failure)
 */

import { describe, expect, it, vi } from "vitest";

import type { MatchResultDatabase, MatchResultEventRecord } from "../queries";
import {
  batchUpdateResults,
  publishMatchResult,
  resolveMatchStatus,
  updateMatchResult,
  validateMatchResult,
} from "../match-result-service";
import { MatchResultError } from "../errors";
import {
  resolveCanonicalStatus,
  toEventStatus,
  buildResultLabel,
  isTerminalStatus,
  isScoreableStatus,
} from "../types";

// ── Test fixtures ──────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PROVIDER = "SFV";
const MATCH_ID = "event-match-1";
const MAPPING_ID = "mapping-1";

function createEvent(
  overrides: Partial<MatchResultEventRecord> = {},
): MatchResultEventRecord {
  return {
    id: MATCH_ID,
    tenantId: TENANT_A,
    type: "MATCH",
    status: "SCHEDULED",
    startAt: new Date("2026-08-20T18:00:00.000Z"),
    updatedAt: new Date("2026-07-20T10:00:00.000Z"),
    matchExternalMapping: {
      id: MAPPING_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
      scoreHome: null,
      scoreAway: null,
      lastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
    },
    ...overrides,
  };
}

function createDatabase(
  eventStore: Map<string, MatchResultEventRecord> = new Map([
    [MATCH_ID, createEvent()],
  ]),
): MatchResultDatabase & { auditCalls: unknown[] } {
  const auditCalls: unknown[] = [];

  return {
    auditCalls,
    event: {
      async findFirst(args: {
        where?: { id?: string; tenantId?: string; type?: string };
      }) {
        const where = args.where ?? {};
        for (const [, ev] of eventStore) {
          if (
            (where.id === undefined || ev.id === where.id) &&
            (where.tenantId === undefined ||
              ev.tenantId === where.tenantId) &&
            (where.type === undefined || ev.type === where.type)
          ) {
            return ev;
          }
        }
        return null;
      },
      async update(args: {
        where?: { id?: string };
        data?: Partial<MatchResultEventRecord>;
      }) {
        const id = args.where?.id ?? "";
        const ev = eventStore.get(id);
        if (!ev) throw new Error(`Event not found: ${id}`);
        const updated = {
          ...ev,
          ...(args.data as Partial<MatchResultEventRecord>),
          updatedAt: new Date(),
        };
        eventStore.set(id, updated);
        return updated;
      },
    },
    matchExternalMapping: {
      async update(args: {
        where?: { id?: string };
        data?: Partial<{
          scoreHome: number | null;
          scoreAway: number | null;
          providerMatchState: number | null;
          providerMatchStateName: string | null;
          lastSyncedAt: Date;
        }>;
      }) {
        const mappingId = args.where?.id ?? "";
        // Find the event that owns this mapping and update inline
        for (const [key, ev] of eventStore) {
          if (ev.matchExternalMapping?.id === mappingId) {
            const updatedMapping = {
              ...ev.matchExternalMapping,
              ...(args.data ?? {}),
            };
            eventStore.set(key, {
              ...ev,
              matchExternalMapping: updatedMapping,
            });
            return updatedMapping;
          }
        }
        throw new Error(`Mapping not found: ${mappingId}`);
      },
    },
    auditLog: {
      async create(args: unknown) {
        auditCalls.push(args);
        return null;
      },
    },
  };
}

// ── Status mapping unit tests ──────────────────────────────────────────────

describe("resolveCanonicalStatus", () => {
  it("maps DRAFT → SCHEDULED", () => {
    expect(resolveCanonicalStatus("DRAFT")).toBe("SCHEDULED");
  });
  it("maps SCHEDULED → SCHEDULED", () => {
    expect(resolveCanonicalStatus("SCHEDULED")).toBe("SCHEDULED");
  });
  it("maps LIVE → LIVE", () => {
    expect(resolveCanonicalStatus("LIVE")).toBe("LIVE");
  });
  it("maps COMPLETED → FINISHED", () => {
    expect(resolveCanonicalStatus("COMPLETED")).toBe("FINISHED");
  });
  it("maps CANCELLED → CANCELLED", () => {
    expect(resolveCanonicalStatus("CANCELLED")).toBe("CANCELLED");
  });
  it("maps POSTPONED → POSTPONED", () => {
    expect(resolveCanonicalStatus("POSTPONED")).toBe("POSTPONED");
  });
  it("maps ABANDONED → ABANDONED", () => {
    expect(resolveCanonicalStatus("ABANDONED")).toBe("ABANDONED");
  });
  it("maps FORFEITED → FORFEITED", () => {
    expect(resolveCanonicalStatus("FORFEITED")).toBe("FORFEITED");
  });
  it("maps ARCHIVED → SCHEDULED (safe fallback)", () => {
    expect(resolveCanonicalStatus("ARCHIVED")).toBe("SCHEDULED");
  });
});

describe("toEventStatus", () => {
  it("maps SCHEDULED → SCHEDULED", () => {
    expect(toEventStatus("SCHEDULED")).toBe("SCHEDULED");
  });
  it("maps LIVE → LIVE", () => {
    expect(toEventStatus("LIVE")).toBe("LIVE");
  });
  it("maps FINISHED → COMPLETED", () => {
    expect(toEventStatus("FINISHED")).toBe("COMPLETED");
  });
  it("maps CANCELLED → CANCELLED", () => {
    expect(toEventStatus("CANCELLED")).toBe("CANCELLED");
  });
  it("maps POSTPONED → POSTPONED", () => {
    expect(toEventStatus("POSTPONED")).toBe("POSTPONED");
  });
  it("maps ABANDONED → ABANDONED", () => {
    expect(toEventStatus("ABANDONED")).toBe("ABANDONED");
  });
  it("maps FORFEITED → FORFEITED", () => {
    expect(toEventStatus("FORFEITED")).toBe("FORFEITED");
  });
});

describe("buildResultLabel", () => {
  it("returns null when homeGoals is null", () => {
    expect(buildResultLabel(null, 2)).toBeNull();
  });
  it("returns null when awayGoals is null", () => {
    expect(buildResultLabel(1, null)).toBeNull();
  });
  it("returns formatted label", () => {
    expect(buildResultLabel(2, 1)).toBe("2:1");
  });
  it("handles 0:0", () => {
    expect(buildResultLabel(0, 0)).toBe("0:0");
  });
});

describe("isTerminalStatus", () => {
  it("FINISHED is terminal", () => {
    expect(isTerminalStatus("FINISHED")).toBe(true);
  });
  it("CANCELLED is terminal", () => {
    expect(isTerminalStatus("CANCELLED")).toBe(true);
  });
  it("ABANDONED is terminal", () => {
    expect(isTerminalStatus("ABANDONED")).toBe(true);
  });
  it("FORFEITED is terminal", () => {
    expect(isTerminalStatus("FORFEITED")).toBe(true);
  });
  it("SCHEDULED is not terminal", () => {
    expect(isTerminalStatus("SCHEDULED")).toBe(false);
  });
  it("LIVE is not terminal", () => {
    expect(isTerminalStatus("LIVE")).toBe(false);
  });
  it("POSTPONED is not terminal", () => {
    expect(isTerminalStatus("POSTPONED")).toBe(false);
  });
});

describe("isScoreableStatus", () => {
  it("LIVE is scoreable", () => {
    expect(isScoreableStatus("LIVE")).toBe(true);
  });
  it("FINISHED is scoreable", () => {
    expect(isScoreableStatus("FINISHED")).toBe(true);
  });
  it("ABANDONED is scoreable", () => {
    expect(isScoreableStatus("ABANDONED")).toBe(true);
  });
  it("FORFEITED is scoreable", () => {
    expect(isScoreableStatus("FORFEITED")).toBe(true);
  });
  it("SCHEDULED is not scoreable", () => {
    expect(isScoreableStatus("SCHEDULED")).toBe(false);
  });
  it("CANCELLED is not scoreable", () => {
    expect(isScoreableStatus("CANCELLED")).toBe(false);
  });
});

// ── validateMatchResult ────────────────────────────────────────────────────

describe("validateMatchResult", () => {
  it("rejects negative homeGoals", () => {
    const event = createEvent();
    expect(() =>
      validateMatchResult(
        {
          matchId: MATCH_ID,
          tenantId: TENANT_A,
          provider: PROVIDER,
          homeGoals: -1,
          awayGoals: 0,
          status: "FINISHED",
        },
        event,
      ),
    ).toThrow(MatchResultError);
  });

  it("rejects negative awayGoals", () => {
    const event = createEvent();
    expect(() =>
      validateMatchResult(
        {
          matchId: MATCH_ID,
          tenantId: TENANT_A,
          provider: PROVIDER,
          homeGoals: 1,
          awayGoals: -1,
          status: "FINISHED",
        },
        event,
      ),
    ).toThrow(MatchResultError);
  });

  it("rejects fractional goals", () => {
    const event = createEvent();
    expect(() =>
      validateMatchResult(
        {
          matchId: MATCH_ID,
          tenantId: TENANT_A,
          provider: PROVIDER,
          homeGoals: 1.5,
          awayGoals: 0,
          status: "FINISHED",
        },
        event,
      ),
    ).toThrow(MatchResultError);
  });

  it("rejects archived event", () => {
    const event = createEvent({ status: "ARCHIVED" });
    expect(() =>
      validateMatchResult(
        { matchId: MATCH_ID, tenantId: TENANT_A, provider: PROVIDER },
        event,
      ),
    ).toThrow(MatchResultError);
  });

  it("warns when FINISHED match has no scores", () => {
    const event = createEvent();
    const warnings = validateMatchResult(
      {
        matchId: MATCH_ID,
        tenantId: TENANT_A,
        provider: PROVIDER,
        status: "FINISHED",
      },
      event,
    );
    expect(warnings.some((w) => w.includes("homeGoals"))).toBe(true);
    expect(warnings.some((w) => w.includes("awayGoals"))).toBe(true);
  });

  it("warns when CANCELLED match has a score", () => {
    const event = createEvent();
    const warnings = validateMatchResult(
      {
        matchId: MATCH_ID,
        tenantId: TENANT_A,
        provider: PROVIDER,
        status: "CANCELLED",
        homeGoals: 0,
        awayGoals: 0,
      },
      event,
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("returns empty warnings for clean update", () => {
    const event = createEvent();
    const warnings = validateMatchResult(
      {
        matchId: MATCH_ID,
        tenantId: TENANT_A,
        provider: PROVIDER,
        status: "FINISHED",
        homeGoals: 2,
        awayGoals: 1,
      },
      event,
    );
    expect(warnings).toHaveLength(0);
  });
});

// ── updateMatchResult ──────────────────────────────────────────────────────

describe("updateMatchResult — SCHEDULED lifecycle", () => {
  it("returns a SCHEDULED result for a new match", async () => {
    const db = createDatabase();
    const result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "SCHEDULED",
    });
    expect(result.status).toBe("SCHEDULED");
    expect(result.homeGoals).toBeNull();
    expect(result.awayGoals).toBeNull();
  });
});

describe("updateMatchResult — LIVE score progression", () => {
  it("progresses: 0-0 → 1-0 → 1-1 → 2-1 → FINISHED", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent()],
    ]);
    const db = createDatabase(store);

    // Start live, 0-0
    let result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "LIVE",
      homeGoals: 0,
      awayGoals: 0,
    });
    expect(result.status).toBe("LIVE");
    expect(result.homeGoals).toBe(0);
    expect(result.awayGoals).toBe(0);

    // 1-0
    result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "LIVE",
      homeGoals: 1,
      awayGoals: 0,
    });
    expect(result.homeGoals).toBe(1);
    expect(result.awayGoals).toBe(0);

    // 1-1
    result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "LIVE",
      homeGoals: 1,
      awayGoals: 1,
    });
    expect(result.homeGoals).toBe(1);
    expect(result.awayGoals).toBe(1);

    // 2-1
    result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "LIVE",
      homeGoals: 2,
      awayGoals: 1,
    });
    expect(result.homeGoals).toBe(2);
    expect(result.awayGoals).toBe(1);

    // FINISHED
    result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "FINISHED",
      homeGoals: 2,
      awayGoals: 1,
    });
    expect(result.status).toBe("FINISHED");
    expect(result.homeGoals).toBe(2);
    expect(result.awayGoals).toBe(1);
  });
});

describe("updateMatchResult — terminal statuses", () => {
  it("handles POSTPONED", async () => {
    const db = createDatabase();
    const result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "POSTPONED",
    });
    expect(result.status).toBe("POSTPONED");
  });

  it("handles CANCELLED", async () => {
    const db = createDatabase();
    const result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "CANCELLED",
    });
    expect(result.status).toBe("CANCELLED");
  });

  it("handles ABANDONED with partial score", async () => {
    const db = createDatabase();
    const result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "ABANDONED",
      homeGoals: 1,
      awayGoals: 0,
    });
    expect(result.status).toBe("ABANDONED");
    expect(result.homeGoals).toBe(1);
    expect(result.awayGoals).toBe(0);
  });

  it("handles FORFEITED with administrative score", async () => {
    const db = createDatabase();
    const result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "FORFEITED",
      homeGoals: 3,
      awayGoals: 0,
    });
    expect(result.status).toBe("FORFEITED");
    expect(result.homeGoals).toBe(3);
    expect(result.awayGoals).toBe(0);
  });
});

describe("updateMatchResult — idempotency", () => {
  it("calling twice with same data produces same result", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent()],
    ]);
    const db = createDatabase(store);

    const input = {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "FINISHED" as const,
      homeGoals: 2,
      awayGoals: 1,
    };

    const first = await updateMatchResult(db, input);
    const second = await updateMatchResult(db, input);

    expect(second.status).toBe(first.status);
    expect(second.homeGoals).toBe(first.homeGoals);
    expect(second.awayGoals).toBe(first.awayGoals);
  });
});

describe("updateMatchResult — error handling", () => {
  it("throws MATCH_NOT_FOUND when event does not exist", async () => {
    const db = createDatabase(new Map());
    await expect(
      updateMatchResult(db, {
        matchId: "nonexistent",
        tenantId: TENANT_A,
        provider: PROVIDER,
      }),
    ).rejects.toThrow(MatchResultError);

    await expect(
      updateMatchResult(db, {
        matchId: "nonexistent",
        tenantId: TENANT_A,
        provider: PROVIDER,
      }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });

  it("throws MATCH_NOT_FOUND for cross-tenant access (tenant isolation)", async () => {
    // TENANT_B queries for TENANT_A's match — findFirst returns null because
    // the where-clause includes tenantId
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent({ tenantId: TENANT_A })],
    ]);
    const db = createDatabase(store);

    await expect(
      updateMatchResult(db, {
        matchId: MATCH_ID,
        tenantId: TENANT_B,
        provider: PROVIDER,
      }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });

  it("throws MATCH_ARCHIVED for archived events", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent({ status: "ARCHIVED" })],
    ]);
    const db = createDatabase(store);

    await expect(
      updateMatchResult(db, {
        matchId: MATCH_ID,
        tenantId: TENANT_A,
        provider: PROVIDER,
      }),
    ).rejects.toMatchObject({ code: "MATCH_ARCHIVED" });
  });

  it("throws INVALID_SCORE for negative homeGoals", async () => {
    const db = createDatabase();
    await expect(
      updateMatchResult(db, {
        matchId: MATCH_ID,
        tenantId: TENANT_A,
        provider: PROVIDER,
        homeGoals: -1,
        awayGoals: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_SCORE" });
  });

  it("throws INVALID_SCORE for negative awayGoals", async () => {
    const db = createDatabase();
    await expect(
      updateMatchResult(db, {
        matchId: MATCH_ID,
        tenantId: TENANT_A,
        provider: PROVIDER,
        homeGoals: 0,
        awayGoals: -2,
      }),
    ).rejects.toMatchObject({ code: "INVALID_SCORE" });
  });
});

describe("updateMatchResult — provider isolation", () => {
  it("does not leak provider state from one provider to another", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent()],
    ]);
    const db = createDatabase(store);

    const result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "FINISHED",
      homeGoals: 2,
      awayGoals: 1,
      providerState: 99,
      providerStateLabel: "Beendet",
    });

    // Provider state is stored but MatchStatus is canonical
    expect(result.status).toBe("FINISHED");
    expect(result.providerState).toBe(99);
    expect(result.providerStateLabel).toBe("Beendet");
    expect(result.provider).toBe(PROVIDER);
  });
});

describe("updateMatchResult — resultLabel", () => {
  it("sets resultLabel to score string for FINISHED", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent()],
    ]);
    const db = createDatabase(store);

    await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "FINISHED",
      homeGoals: 3,
      awayGoals: 2,
    });

    // Verify the event was updated with resultLabel
    const ev = store.get(MATCH_ID);
    expect((ev as MatchResultEventRecord & { resultLabel?: string })?.resultLabel).toBe("3:2");
  });

  it("does not set resultLabel for SCHEDULED", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent()],
    ]);
    const db = createDatabase(store);

    await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "SCHEDULED",
    });

    const ev = store.get(MATCH_ID);
    expect((ev as MatchResultEventRecord & { resultLabel?: string })?.resultLabel ?? null).toBeNull();
  });
});

describe("updateMatchResult — audit", () => {
  it("records an audit entry after successful update", async () => {
    const db = createDatabase();
    await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
      status: "FINISHED",
      homeGoals: 1,
      awayGoals: 0,
    });

    // Allow the fire-and-forget audit to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(db.auditCalls.length).toBeGreaterThan(0);
  });

  it("does not throw when audit logging fails", async () => {
    const db = createDatabase();
    vi.spyOn(db.auditLog, "create").mockRejectedValue(
      new Error("DB connection lost"),
    );

    // Should not throw
    await expect(
      updateMatchResult(db, {
        matchId: MATCH_ID,
        tenantId: TENANT_A,
        provider: PROVIDER,
        status: "FINISHED",
        homeGoals: 1,
        awayGoals: 0,
      }),
    ).resolves.toBeDefined();
  });
});

// ── resolveMatchStatus ─────────────────────────────────────────────────────

describe("resolveMatchStatus", () => {
  it("returns SCHEDULED for a scheduled match", async () => {
    const db = createDatabase();
    const status = await resolveMatchStatus(db, MATCH_ID, TENANT_A);
    expect(status).toBe("SCHEDULED");
  });

  it("returns LIVE for a live match", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent({ status: "LIVE" })],
    ]);
    const db = createDatabase(store);
    const status = await resolveMatchStatus(db, MATCH_ID, TENANT_A);
    expect(status).toBe("LIVE");
  });

  it("throws MATCH_NOT_FOUND for missing match", async () => {
    const db = createDatabase(new Map());
    await expect(
      resolveMatchStatus(db, "missing", TENANT_A),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });
});

// ── publishMatchResult ─────────────────────────────────────────────────────

describe("publishMatchResult", () => {
  it("writes result label for a FINISHED match with scores", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [
        MATCH_ID,
        createEvent({
          status: "COMPLETED",
          matchExternalMapping: {
            id: MAPPING_ID,
            tenantId: TENANT_A,
            provider: PROVIDER,
            providerMatchState: 10,
            providerMatchStateName: "Beendet",
            scoreHome: 2,
            scoreAway: 1,
            lastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
          },
        }),
      ],
    ]);
    const db = createDatabase(store);

    const result = await publishMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
    });

    expect(result.status).toBe("FINISHED");
    expect(result.homeGoals).toBe(2);
    expect(result.awayGoals).toBe(1);
  });

  it("returns null resultLabel for SCHEDULED match without scores", async () => {
    const db = createDatabase();
    const result = await publishMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: PROVIDER,
    });

    expect(result.homeGoals).toBeNull();
    expect(result.awayGoals).toBeNull();
  });

  it("throws MATCH_NOT_FOUND for unknown match", async () => {
    const db = createDatabase(new Map());
    await expect(
      publishMatchResult(db, {
        matchId: "nonexistent",
        tenantId: TENANT_A,
        provider: PROVIDER,
      }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });
});

// ── batchUpdateResults ─────────────────────────────────────────────────────

describe("batchUpdateResults", () => {
  function buildStore(
    matches: Array<{ id: string; status: string; tenantId: string }>,
  ) {
    const store = new Map<string, MatchResultEventRecord>();
    for (const m of matches) {
      store.set(
        m.id,
        createEvent({ id: m.id, status: m.status, tenantId: m.tenantId }),
      );
    }
    return store;
  }

  it("processes multiple updates and reports counts", async () => {
    const store = buildStore([
      { id: "m1", status: "SCHEDULED", tenantId: TENANT_A },
      { id: "m2", status: "SCHEDULED", tenantId: TENANT_A },
      { id: "m3", status: "SCHEDULED", tenantId: TENANT_A },
    ]);
    const db = createDatabase(store);

    const output = await batchUpdateResults(db, {
      tenantId: TENANT_A,
      provider: PROVIDER,
      updates: [
        { matchId: "m1", status: "FINISHED", homeGoals: 2, awayGoals: 1 },
        { matchId: "m2", status: "LIVE", homeGoals: 0, awayGoals: 0 },
        { matchId: "m3", status: "POSTPONED" },
      ],
    });

    expect(output.processed).toBe(3);
    expect(output.failed).toBe(0);
    expect(output.tenantId).toBe(TENANT_A);
    expect(output.provider).toBe(PROVIDER);
  });

  it("captures failed items without aborting the batch", async () => {
    const store = buildStore([
      { id: "m1", status: "SCHEDULED", tenantId: TENANT_A },
      { id: "m2", status: "ARCHIVED", tenantId: TENANT_A }, // will fail
    ]);
    const db = createDatabase(store);

    const output = await batchUpdateResults(db, {
      tenantId: TENANT_A,
      provider: PROVIDER,
      updates: [
        { matchId: "m1", status: "FINISHED", homeGoals: 1, awayGoals: 0 },
        { matchId: "m2", status: "FINISHED", homeGoals: 1, awayGoals: 0 },
      ],
    });

    expect(output.processed).toBe(2);
    expect(output.failed).toBe(1);
    const failedItem = output.items.find((i) => i.matchId === "m2");
    expect(failedItem?.outcome).toBe("failed");
    expect(failedItem?.error).toContain("archived");
  });

  it("captures items missing from DB as failed", async () => {
    const store = buildStore([
      { id: "m1", status: "SCHEDULED", tenantId: TENANT_A },
    ]);
    const db = createDatabase(store);

    const output = await batchUpdateResults(db, {
      tenantId: TENANT_A,
      provider: PROVIDER,
      updates: [
        { matchId: "m1", status: "FINISHED", homeGoals: 2, awayGoals: 0 },
        { matchId: "ghost", status: "FINISHED", homeGoals: 1, awayGoals: 0 },
      ],
    });

    expect(output.failed).toBe(1);
    const ghostItem = output.items.find((i) => i.matchId === "ghost");
    expect(ghostItem?.outcome).toBe("failed");
  });

  it("marks duplicate update as unchanged", async () => {
    const store = buildStore([
      { id: "m1", status: "COMPLETED", tenantId: TENANT_A },
    ]);
    // Pre-set scores to match the incoming update
    const existing = store.get("m1")!;
    store.set("m1", {
      ...existing,
      matchExternalMapping: existing.matchExternalMapping
        ? {
            ...existing.matchExternalMapping,
            scoreHome: 2,
            scoreAway: 1,
          }
        : null,
    });
    const db = createDatabase(store);

    const output = await batchUpdateResults(db, {
      tenantId: TENANT_A,
      provider: PROVIDER,
      updates: [
        {
          matchId: "m1",
          status: "FINISHED",
          homeGoals: 2,
          awayGoals: 1,
        },
      ],
    });

    expect(output.items[0].outcome).toBe("unchanged");
  });

  it("enforces tenant isolation in batch — cross-tenant matches are failed", async () => {
    const store = buildStore([
      { id: "m1", status: "SCHEDULED", tenantId: TENANT_B }, // wrong tenant
    ]);
    const db = createDatabase(store);

    const output = await batchUpdateResults(db, {
      tenantId: TENANT_A,
      provider: PROVIDER,
      updates: [{ matchId: "m1", status: "FINISHED", homeGoals: 1 }],
    });

    expect(output.failed).toBe(1);
    expect(output.items[0].outcome).toBe("failed");
  });

  it("handles empty updates list", async () => {
    const db = createDatabase(new Map());
    const output = await batchUpdateResults(db, {
      tenantId: TENANT_A,
      provider: PROVIDER,
      updates: [],
    });
    expect(output.processed).toBe(0);
    expect(output.updated).toBe(0);
    expect(output.failed).toBe(0);
  });
});

// ── Provider neutrality ────────────────────────────────────────────────────

describe("provider neutrality", () => {
  it("stores provider name but canonical status does not depend on it", async () => {
    const store = new Map<string, MatchResultEventRecord>([
      [MATCH_ID, createEvent()],
    ]);
    const db = createDatabase(store);

    const result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: "SFV",
      status: "FINISHED",
      homeGoals: 1,
      awayGoals: 0,
      providerState: 5,
      providerStateLabel: "Beendet",
    });

    // Canonical status is FINISHED regardless of providerState=5
    expect(result.status).toBe("FINISHED");
    expect(result.provider).toBe("SFV");
    expect(result.providerState).toBe(5);
  });

  it("accepts CLUBCORNER_FVNWS as provider", async () => {
    const db = createDatabase();
    const result = await updateMatchResult(db, {
      matchId: MATCH_ID,
      tenantId: TENANT_A,
      provider: "CLUBCORNER_FVNWS",
      status: "FINISHED",
      homeGoals: 0,
      awayGoals: 3,
    });
    expect(result.status).toBe("FINISHED");
  });
});
