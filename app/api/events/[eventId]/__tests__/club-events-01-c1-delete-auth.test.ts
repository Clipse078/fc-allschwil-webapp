/**
 * app/api/events/[eventId]/__tests__/club-events-01-c1-delete-auth.test.ts
 *
 * CLUB-EVENTS-01-C1 — Focused tests for the DELETE /api/events/[eventId]
 * permanent-delete authorization split.
 *
 * These tests verify ROUTE wiring only. The resolver's full Club Admin /
 * SCE Super Admin / delegated-user grant logic is covered at the resolver
 * level (lib/permissions/services/effective-permission-resolver.ts tests).
 *
 * TEST COVERAGE MAP:
 *   1. events.delete → permanent delete allowed within own tenant.
 *   2. events.manage without events.delete → 403 for permanent delete.
 *   3. Unauthorized (no session) → 401 for permanent delete.
 *   4. Cross-tenant permanent delete → 404 before permission resolution.
 *   5. Archive (no ?permanent) still uses events.manage → allowed.
 *   6. Archive (no ?permanent) without events.manage → denied.
 *   7. Event not found → 404 for permanent delete (before resolver called).
 *   8. Club Admin: active tenant scopes both lookup and permission resolution.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  eventFindFirst: vi.fn(),
  deleteClubEvent: vi.fn(),
  archiveClubEvent: vi.fn(),
  requireApiPermission: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasTenantDeletionAuthority: mocks.hasTenantDeletionAuthority,
  }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findFirst: (...args: unknown[]) => mocks.eventFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/events/club-events-service", () => ({
  deleteClubEvent: mocks.deleteClubEvent,
  archiveClubEvent: mocks.archiveClubEvent,
  restoreClubEvent: vi.fn(),
  getClubEvent: vi.fn(),
  updateClubEvent: vi.fn(),
  ClubEventNotFoundError: class ClubEventNotFoundError extends Error {
    constructor() { super("Veranstaltung nicht gefunden."); }
  },
  ClubEventValidationError: class ClubEventValidationError extends Error {
    constructor(message: string) { super(message); }
  },
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: vi.fn().mockResolvedValue({
    ok: true,
    session: { user: { id: "user-01", activeTenantId: "tenant-a", permissionKeys: [] } },
  }),
}));

import { DELETE } from "../route";

const EVENT_ID = "event-01";
const TENANT_A = "tenant-a";

function makeContext() {
  return { params: Promise.resolve({ eventId: EVENT_ID }) };
}

function makeSession(userId = "user-01", activeTenantId = TENANT_A) {
  return { user: { id: userId, effectiveUserId: userId, activeTenantId } };
}

function permanentUrl() {
  return `http://localhost/api/events/${EVENT_ID}?permanent=true`;
}

function archiveUrl() {
  return `http://localhost/api/events/${EVENT_ID}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logAction.mockResolvedValue(undefined);
  mocks.deleteClubEvent.mockResolvedValue(undefined);
  mocks.archiveClubEvent.mockResolvedValue({ id: EVENT_ID, status: "ARCHIVED" });
  // Default: event exists in tenant-a
  mocks.eventFindFirst.mockResolvedValue({ id: EVENT_ID });
});

describe("DELETE /api/events/[eventId] — CLUB-EVENTS-01-C1 permanent delete auth", () => {
  it("1 — events.delete → permanent delete allowed within own tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeSession("club-admin-1", TENANT_A));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: EVENT_ID });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);

    const response = await DELETE(new NextRequest(permanentUrl()), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "club-admin-1",
      permission: "events.delete",
      tenantId: TENANT_A,
    });
    expect(mocks.deleteClubEvent).toHaveBeenCalledWith(TENANT_A, EVENT_ID);
  });

  it("2 — events.manage without events.delete → 403 for permanent delete", async () => {
    mocks.auth.mockResolvedValueOnce(makeSession("manage-only-user"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: EVENT_ID });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(permanentUrl()), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "events.delete" }),
    );
    expect(mocks.deleteClubEvent).not.toHaveBeenCalled();
  });

  it("3 — no session → 401 for permanent delete", async () => {
    mocks.auth.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(permanentUrl()), makeContext());

    expect(response.status).toBe(401);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteClubEvent).not.toHaveBeenCalled();
  });

  it("4 — cross-tenant event is hidden as not found", async () => {
    mocks.auth.mockResolvedValueOnce(makeSession("club-admin-a", TENANT_A));
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(permanentUrl()), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteClubEvent).not.toHaveBeenCalled();
  });

  it("5 — archive (no ?permanent) with events.manage → allowed, resolver not called", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({
      ok: true,
      session: {
        user: {
          id: "club-admin-1",
          effectiveUserId: "club-admin-1",
          activeTenantId: TENANT_A,
        },
      },
    });

    const response = await DELETE(new NextRequest(archiveUrl()), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.archiveClubEvent).toHaveBeenCalledWith(TENANT_A, EVENT_ID);
    expect(mocks.deleteClubEvent).not.toHaveBeenCalled();
  });

  it("6 — archive (no ?permanent) without events.manage → denied by requireApiPermission", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Forbidden",
    });

    const response = await DELETE(new NextRequest(archiveUrl()), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.archiveClubEvent).not.toHaveBeenCalled();
    expect(mocks.deleteClubEvent).not.toHaveBeenCalled();
  });

  it("7 — event not found → 404 for permanent delete (resolver never called)", async () => {
    mocks.auth.mockResolvedValueOnce(makeSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(permanentUrl()), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteClubEvent).not.toHaveBeenCalled();
  });

  it("8 — active tenant scopes lookup and Club Admin authority", async () => {
    mocks.auth.mockResolvedValueOnce(makeSession("club-admin-a", TENANT_A));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: EVENT_ID });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);

    const response = await DELETE(new NextRequest(permanentUrl()), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.eventFindFirst).toHaveBeenCalledWith({
      where: { id: EVENT_ID, type: "OTHER", tenantId: TENANT_A },
      select: { id: true },
    });
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.deleteClubEvent).toHaveBeenCalledWith(TENANT_A, EVENT_ID);
  });
});
