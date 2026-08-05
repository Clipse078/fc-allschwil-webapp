/**
 * lib/registrations/__tests__/timeline.test.ts
 *
 * REGISTRATION-01F — Goal 5: simple chronological timeline built entirely
 * from the existing AuditLog (no new event-log table).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  registrationFindFirst: vi.fn(),
  auditLogFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    registration: { findFirst: mocks.registrationFindFirst },
    auditLog: { findMany: mocks.auditLogFindMany },
  },
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-allschwil" }),
}));

import { getRegistrationTimeline } from "@/lib/registrations/timeline";

beforeEach(() => {
  vi.clearAllMocks();
});

function logEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    action: "STATUS_CHANGE",
    beforeJson: null,
    afterJson: null,
    createdAt: new Date("2026-08-05T10:00:00.000Z"),
    actorUser: null,
    ...overrides,
  };
}

describe("getRegistrationTimeline", () => {
  it("returns an empty array when the registration doesn't exist in this tenant", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(null);
    const result = await getRegistrationTimeline("fc-allschwil", "missing");
    expect(result).toEqual([]);
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled();
  });

  it("synthesizes a RECEIVED entry from submittedAt when no WEBSITE_SUBMISSION log exists", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce({
      id: "reg-1",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([]);

    const result = await getRegistrationTimeline("fc-allschwil", "reg-1");

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("RECEIVED");
    expect(result[0].occurredAt).toBe("2026-08-01T09:00:00.000Z");
  });

  it("does not duplicate the RECEIVED entry when a WEBSITE_SUBMISSION log already exists", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce({
      id: "reg-1",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      logEntry({ action: "WEBSITE_SUBMISSION", afterJson: { source: "WEBSITE" } }),
    ]);

    const result = await getRegistrationTimeline("fc-allschwil", "reg-1");

    expect(result.filter((e) => e.kind === "RECEIVED")).toHaveLength(1);
  });

  it("sorts entries newest first", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce({
      id: "reg-1",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      logEntry({ id: "log-2", createdAt: new Date("2026-08-03T09:00:00.000Z"), action: "OTHER_ACTION" }),
      logEntry({ id: "log-1", createdAt: new Date("2026-08-02T09:00:00.000Z"), action: "OTHER_ACTION" }),
    ]);

    const result = await getRegistrationTimeline("fc-allschwil", "reg-1");
    const occurredAts = result.map((e) => e.occurredAt);
    expect(occurredAts).toEqual([...occurredAts].sort().reverse());
  });

  it("labels a STATUS_CHANGE to CONTACTED as a dedicated 'Contacted' entry", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce({
      id: "reg-1",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      logEntry({ action: "STATUS_CHANGE", beforeJson: { status: "NEW" }, afterJson: { status: "CONTACTED" } }),
    ]);

    const result = await getRegistrationTimeline("fc-allschwil", "reg-1");
    expect(result[0].kind).toBe("CONTACTED");
  });

  it("labels a STATUS_CHANGE to ARCHIVED as a dedicated 'Archived' entry", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce({
      id: "reg-1",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      logEntry({ action: "STATUS_CHANGE", beforeJson: { status: "WAITING" }, afterJson: { status: "ARCHIVED" } }),
    ]);

    const result = await getRegistrationTimeline("fc-allschwil", "reg-1");
    expect(result[0].kind).toBe("ARCHIVED");
  });

  it("includes the actor's name when the audit entry has one", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce({
      id: "reg-1",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      logEntry({ actorUser: { firstName: "Anna", lastName: "Admin" } }),
    ]);

    const result = await getRegistrationTimeline("fc-allschwil", "reg-1");
    expect(result[0].actorName).toBe("Anna Admin");
  });

  it("maps PERSON_CREATED, PERSON_LINKED and DUPLICATE_IGNORED to their dedicated kinds", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce({
      id: "reg-1",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      logEntry({ id: "a", action: "PERSON_CREATED", createdAt: new Date("2026-08-04T00:00:00.000Z") }),
      logEntry({ id: "b", action: "PERSON_LINKED", createdAt: new Date("2026-08-03T00:00:00.000Z") }),
      logEntry({ id: "c", action: "DUPLICATE_IGNORED", createdAt: new Date("2026-08-02T00:00:00.000Z") }),
    ]);

    const result = await getRegistrationTimeline("fc-allschwil", "reg-1");
    const kinds = result.map((e) => e.kind);
    expect(kinds).toEqual(["PERSON_CREATED", "PERSON_LINKED", "DUPLICATE_IGNORED", "RECEIVED"]);
  });
});
