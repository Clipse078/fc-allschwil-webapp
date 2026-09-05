/**
 * MEIN-KONTO-01 — /api/account/me route tests
 *
 * Covers:
 * - GET returns User + linked Person for authenticated caller
 * - GET returns 401 when unauthenticated
 * - GET returns User without Person when no Person is linked in active tenant
 * - PATCH updates Person fields when Person is linked (name + phone)
 * - PATCH updates User directly when no Person is linked
 * - PATCH returns 401 when unauthenticated
 * - PATCH rejects empty firstName
 * - PATCH rejects firstName > 100 chars
 * - PATCH rejects empty lastName
 * - PATCH rejects phone > 50 chars
 * - Tenant isolation: getLinkedPerson scopes by both userId AND tenantId
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const SESSION_USER = {
  id: "user-001",
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Test",
  activeTenantId: "tenant-001",
  permissionKeys: [],
  roleKeys: [],
  isImpersonating: false,
  activeMembershipId: "mem-001",
  availableTenants: [],
};

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  refreshEffectiveUserSession: vi.fn(),
  userFindUnique: vi.fn(),
  personFindFirst: vi.fn(),
  personUpdate: vi.fn(),
  userUpdate: vi.fn(),
  tenantFindUnique: vi.fn(),
  transaction: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
  refreshEffectiveUserSession: mocks.refreshEffectiveUserSession,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
    person: {
      findFirst: mocks.personFindFirst,
      update: mocks.personUpdate,
    },
    tenant: {
      findUnique: mocks.tenantFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { GET, PATCH } from "@/app/api/account/me/route";
import { NextRequest } from "next/server";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DB_USER = {
  id: "user-001",
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Test",
  isActive: true,
  lastLoginAt: null,
};

const DB_PERSON = {
  id: "person-001",
  firstName: "Alice",
  lastName: "Test",
  phone: "+41 79 000 00 00",
  imageUrl: null,
  tenantId: "tenant-001",
  isActive: true,
};

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/account/me", {
    method: body !== undefined ? "PATCH" : "GET",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/account/me", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.logAction.mockResolvedValue(undefined);
    mocks.tenantFindUnique.mockResolvedValue({ name: "FC Allschwil" });
  });

  it("returns 401 when not authenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/authentifiziert/i);
  });

  it("returns User + linked Person when both exist", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    mocks.personFindFirst.mockResolvedValue(DB_PERSON);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.user.id).toBe("user-001");
    expect(body.user.email).toBe("alice@example.com");
    expect(body.linkedPerson).not.toBeNull();
    expect(body.linkedPerson.phone).toBe("+41 79 000 00 00");
    expect(body.tenantName).toBe("FC Allschwil");
  });

  it("returns null linkedPerson when no Person linked in tenant", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    mocks.personFindFirst.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linkedPerson).toBeNull();
  });

  it("queries Person scoped to both userId AND activeTenantId (tenant isolation)", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    mocks.personFindFirst.mockResolvedValue(null);

    await GET();

    expect(mocks.personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-001",
          tenantId: "tenant-001",
        }),
      }),
    );
  });

  it("returns null linkedPerson when activeTenantId is null", async () => {
    mocks.auth.mockResolvedValue({
      user: { ...SESSION_USER, activeTenantId: null },
    });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    // personFindFirst should NOT be called when tenantId is null
    mocks.personFindFirst.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linkedPerson).toBeNull();
    // Verify person lookup was skipped (no tenantId → no query)
    expect(mocks.personFindFirst).not.toHaveBeenCalled();
  });
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/account/me", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.logAction.mockResolvedValue(undefined);
    mocks.refreshEffectiveUserSession.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op;
    });
  });

  it("returns 401 when not authenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const req = makeRequest({ firstName: "Bob", lastName: "Smith" });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("updates Person + User when Person is linked", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue(DB_PERSON);
    mocks.personUpdate.mockResolvedValue({});
    mocks.userUpdate.mockResolvedValue({});

    const req = makeRequest({ firstName: "Alicia", lastName: "Tester", phone: "+41 77 111" });
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.firstName).toBe("Alicia");
    expect(body.lastName).toBe("Tester");
    expect(body.phone).toBe("+41 77 111");

    // Both Person and User should be updated via $transaction
    expect(mocks.transaction).toHaveBeenCalled();
  });

  it("updates User directly when no Person is linked", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue(null);
    mocks.userUpdate.mockResolvedValue({});

    const req = makeRequest({ firstName: "Bob", lastName: "Smith" });
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    // When no Person is linked, transaction is NOT used — userUpdate is called directly
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-001" },
        data: { firstName: "Bob", lastName: "Smith" },
      }),
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects empty firstName", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    const req = makeRequest({ firstName: "", lastName: "Smith" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Vorname/);
  });

  it("rejects firstName longer than 100 chars", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    const req = makeRequest({ firstName: "A".repeat(101), lastName: "Smith" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/100 Zeichen/);
  });

  it("rejects empty lastName", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    const req = makeRequest({ firstName: "Bob", lastName: "" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Nachname/);
  });

  it("rejects phone longer than 50 chars", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue(DB_PERSON);
    const req = makeRequest({ firstName: "Bob", lastName: "Smith", phone: "1".repeat(51) });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/50 Zeichen/);
  });

  it("refreshes presentation from trusted server state after save", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue(null);
    mocks.userUpdate.mockResolvedValue({});

    const req = makeRequest({ firstName: "Bob", lastName: "Smith" });
    await PATCH(req);

    expect(mocks.refreshEffectiveUserSession).toHaveBeenCalledWith("user-001");
  });

  it("does not allow email change (read-only field)", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue(null);
    mocks.userUpdate.mockResolvedValue({});

    const req = makeRequest({ firstName: "Bob", lastName: "Smith", email: "hacker@evil.com" });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    // email must never appear in the update data
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ email: expect.anything() }),
      }),
    );
  });
});
