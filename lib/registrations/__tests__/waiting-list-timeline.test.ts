/**
 * lib/registrations/__tests__/waiting-list-timeline.test.ts
 *
 * REG-WAIT-01J — Waiting-list Verlauf actor accountability.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  waitingListEntryFindFirst: vi.fn(),
  auditLogFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    waitingListEntry: { findFirst: mocks.waitingListEntryFindFirst },
    auditLog: { findMany: mocks.auditLogFindMany },
  },
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-allschwil" }),
}));

import { getWaitingListTimeline } from "@/lib/registrations/waiting-list-timeline";

beforeEach(() => {
  vi.clearAllMocks();
});

function linkedActor() {
  return {
    firstName: "FC Allschwil",
    lastName: "Club Admin",
    email: "admin@fcallschwil.ch",
    person: {
      firstName: "Michael",
      lastName: "Duijster",
      displayName: null,
    },
  };
}

describe("getWaitingListTimeline", () => {
  it("returns an empty array when the entry does not exist in this tenant", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValueOnce(null);

    const result = await getWaitingListTimeline("fc-allschwil", "missing");

    expect(result).toEqual([]);
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled();
  });

  it("resolves linked Person name for WAITING_LIST_CREATED audit entries", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValueOnce({
      id: "entry-1",
      addedAt: new Date("2026-08-20T20:59:00.000Z"),
      lastContactedAt: null,
      offeredAt: null,
      resolvedAt: null,
      status: "WAITING",
      addedByUser: linkedActor(),
      resolvedByUser: null,
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      {
        id: "log-1",
        action: "WAITING_LIST_CREATED",
        afterJson: { registrationId: "reg-1" },
        createdAt: new Date("2026-08-20T20:59:00.000Z"),
        actorUser: linkedActor(),
      },
    ]);

    const result = await getWaitingListTimeline("fc-allschwil", "entry-1");

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Auf Warteliste gesetzt");
    expect(result[0].actorName).toBe("Michael Duijster");
  });

  it("falls back to entry.addedByUser for legacy entries without audit logs", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValueOnce({
      id: "entry-1",
      addedAt: new Date("2026-08-20T20:59:00.000Z"),
      lastContactedAt: null,
      offeredAt: null,
      resolvedAt: null,
      status: "WAITING",
      addedByUser: linkedActor(),
      resolvedByUser: null,
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([]);

    const result = await getWaitingListTimeline("fc-allschwil", "entry-1");

    expect(result).toHaveLength(1);
    expect(result[0].actorName).toBe("Michael Duijster");
  });

  it("does not fabricate a human actor when none is present", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValueOnce({
      id: "entry-1",
      addedAt: new Date("2026-08-20T20:59:00.000Z"),
      lastContactedAt: new Date("2026-08-21T10:00:00.000Z"),
      offeredAt: null,
      resolvedAt: null,
      status: "CONTACTED",
      addedByUser: null,
      resolvedByUser: null,
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([]);

    const result = await getWaitingListTimeline("fc-allschwil", "entry-1");

    expect(result.find((e) => e.label === "Auf Warteliste gesetzt")?.actorName).toBeNull();
    expect(result.find((e) => e.label === "Kontaktiert")?.actorName).toBeNull();
  });

  it("includes actors from status-change audit entries", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValueOnce({
      id: "entry-1",
      addedAt: new Date("2026-08-20T20:59:00.000Z"),
      lastContactedAt: new Date("2026-08-21T10:00:00.000Z"),
      offeredAt: null,
      resolvedAt: null,
      status: "CONTACTED",
      addedByUser: linkedActor(),
      resolvedByUser: null,
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      {
        id: "log-1",
        action: "WAITING_LIST_CREATED",
        afterJson: {},
        createdAt: new Date("2026-08-20T20:59:00.000Z"),
        actorUser: linkedActor(),
      },
      {
        id: "log-2",
        action: "WAITING_LIST_STATUS_CHANGE",
        afterJson: { status: "CONTACTED" },
        createdAt: new Date("2026-08-21T10:00:00.000Z"),
        actorUser: linkedActor(),
      },
    ]);

    const result = await getWaitingListTimeline("fc-allschwil", "entry-1");

    expect(result.map((e) => e.label)).toEqual(["Auf Warteliste gesetzt", "Kontaktiert"]);
    expect(result.every((e) => e.actorName === "Michael Duijster")).toBe(true);
  });

  it("includes successful outbound email with the human actor", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValueOnce({
      id: "entry-1",
      addedAt: new Date("2026-08-20T20:59:00.000Z"),
      lastContactedAt: null,
      offeredAt: null,
      resolvedAt: null,
      status: "WAITING",
      addedByUser: linkedActor(),
      resolvedByUser: null,
    });
    mocks.auditLogFindMany.mockResolvedValueOnce([
      {
        id: "log-1",
        action: "EMAIL_SENT",
        afterJson: { communicationEntityId: "message-1" },
        createdAt: new Date("2026-08-21T10:00:00.000Z"),
        actorUser: linkedActor(),
      },
    ]);

    const result = await getWaitingListTimeline("fc-allschwil", "entry-1");
    expect(result.find((event) => event.label === "E-Mail gesendet")).toMatchObject({
      actorName: "Michael Duijster",
    });
  });
});
