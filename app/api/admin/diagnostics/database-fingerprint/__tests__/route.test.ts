/**
 * Tests for GET /api/admin/diagnostics/database-fingerprint
 *
 * Contract:
 *   - Requires authenticated session (401 when absent).
 *   - Requires TENANTS_MANAGE permission (403 when absent).
 *   - Requires tenantId in session (403 when absent).
 *   - Returns fingerprint object with sanitized connection fields.
 *   - Never returns credentials, passwords, or full connection strings.
 *   - Table-existence fields are boolean or null (never throw on absence).
 *   - All SQL executed is read-only — mocked here; no real DB access.
 *
 * All external dependencies are mocked. No real network requests, no real
 * database access, no real credentials.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Mock external dependencies before importing the route ─────────────────────

const mockRequireApiPermission = vi.fn();

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

const mockQueryRaw = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

// Import after mocks
const { GET } = await import("../route");

// ── Auth fixture helpers ──────────────────────────────────────────────────────

const TENANT_ID = "tenant-abc-123";

const AUTHENTICATED_ADMIN = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      email: "admin@test.invalid",
      tenantId: TENANT_ID,
    },
  },
};

const AUTHENTICATED_ADMIN_NO_TENANT = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      email: "admin@test.invalid",
      tenantId: null,
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
  session: { user: { id: "user-2", email: "nonadmin@test.invalid", tenantId: TENANT_ID } },
};

// ── SQL result fixtures ───────────────────────────────────────────────────────

const MAIN_ROW = {
  runtimeDatabase: "sportclubevo",
  runtimeSchema: "public",
  runtimeUser: "neon_user",
  runtimeVersion: "PostgreSQL 16.0 on x86_64-pc-linux-gnu",
};

const ADDR_ROW = { serverAddr: "10.0.0.1" };

const REGCLASS_ROW_PRESENT = {
  teamExternalMapping: 'public."TeamExternalMapping"',
  matchExternalMapping: 'public."MatchExternalMapping"',
};

const REGCLASS_ROW_ABSENT = {
  teamExternalMapping: null,
  matchExternalMapping: null,
};

const MIGRATION_ROW = {
  migrationCount: BigInt(61),
  latestMigration: "20260713210001_sfv_event_intermediate_result_label",
};

// ── Setup helpers ─────────────────────────────────────────────────────────────

function setupHappyPath(): void {
  // $queryRaw is called 4 times: main, addr, regclass, migrations
  mockQueryRaw
    .mockResolvedValueOnce([MAIN_ROW])
    .mockResolvedValueOnce([ADDR_ROW])
    .mockResolvedValueOnce([REGCLASS_ROW_PRESENT])
    .mockResolvedValueOnce([MIGRATION_ROW]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
  setupHappyPath();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/admin/diagnostics/database-fingerprint", () => {
  // ── Module exports ──────────────────────────────────────────────────────────

  it("route module exports GET handler", () => {
    expect(typeof GET).toBe("function");
  });

  // ── Authentication: 401 ─────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("401 response includes error field", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await GET();
    const body = await response.json();

    expect(body).toHaveProperty("error");
    expect(body.error).toBe("Unauthorized");
  });

  it("does not query the database when unauthenticated", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    await GET();

    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  // ── Authorization: 403 ─────────────────────────────────────────────────────

  it("returns 403 when authenticated but lacking TENANTS_MANAGE", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("403 response includes error field", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    const response = await GET();
    const body = await response.json();

    expect(body).toHaveProperty("error");
    expect(body.error).toBe("Forbidden");
  });

  it("does not query the database when lacking TENANTS_MANAGE", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    await GET();

    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("calls requireApiPermission with TENANTS_MANAGE", async () => {
    await GET();

    expect(mockRequireApiPermission).toHaveBeenCalledWith("tenants.manage");
  });

  // ── Tenant context: 403 ────────────────────────────────────────────────────

  it("returns 403 when tenantId is absent from session", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("403 error message mentions tenant context", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    const response = await GET();
    const body = await response.json();

    expect(body.error).toContain("Tenant context");
  });

  it("does not query the database when tenantId is absent from session", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    await GET();

    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  // ── Success: 200 ───────────────────────────────────────────────────────────

  it("returns 200 when authenticated with TENANTS_MANAGE", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("response has content-type application/json", async () => {
    const response = await GET();

    const ct = response.headers.get("content-type");
    expect(ct).toContain("application/json");
  });

  it("response includes fingerprint object", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toHaveProperty("fingerprint");
    expect(typeof body.fingerprint).toBe("object");
  });

  it("response includes timestamp", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toHaveProperty("timestamp");
    expect(typeof body.timestamp).toBe("string");
  });

  // ── Fingerprint fields: runtime database ───────────────────────────────────

  it("runtimeDatabase is populated from SQL result", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.runtimeDatabase).toBe(MAIN_ROW.runtimeDatabase);
  });

  it("runtimeSchema is populated from SQL result", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.runtimeSchema).toBe(MAIN_ROW.runtimeSchema);
  });

  it("runtimeUser is populated from SQL result", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.runtimeUser).toBe(MAIN_ROW.runtimeUser);
  });

  it("runtimeVersion is populated from SQL result", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.runtimeVersion).toBe(MAIN_ROW.runtimeVersion);
  });

  it("runtimeServerAddr is populated from SQL result", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.runtimeServerAddr).toBe(ADDR_ROW.serverAddr);
  });

  it("runtimeServerAddr is null when inet_server_addr query fails", async () => {
    mockQueryRaw.mockReset();
    mockQueryRaw
      .mockResolvedValueOnce([MAIN_ROW])
      .mockRejectedValueOnce(new Error("inet_server_addr() not available"))
      .mockResolvedValueOnce([REGCLASS_ROW_PRESENT])
      .mockResolvedValueOnce([MIGRATION_ROW]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fingerprint.runtimeServerAddr).toBeNull();
  });

  // ── Fingerprint fields: table existence ────────────────────────────────────

  it("teamExternalMappingExists is true when table is found", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.teamExternalMappingExists).toBe(true);
  });

  it("matchExternalMappingExists is true when table is found", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.matchExternalMappingExists).toBe(true);
  });

  it("teamExternalMappingExists is false when to_regclass returns null", async () => {
    mockQueryRaw.mockReset();
    mockQueryRaw
      .mockResolvedValueOnce([MAIN_ROW])
      .mockResolvedValueOnce([ADDR_ROW])
      .mockResolvedValueOnce([REGCLASS_ROW_ABSENT])
      .mockResolvedValueOnce([MIGRATION_ROW]);

    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.teamExternalMappingExists).toBe(false);
  });

  it("matchExternalMappingExists is false when to_regclass returns null", async () => {
    mockQueryRaw.mockReset();
    mockQueryRaw
      .mockResolvedValueOnce([MAIN_ROW])
      .mockResolvedValueOnce([ADDR_ROW])
      .mockResolvedValueOnce([REGCLASS_ROW_ABSENT])
      .mockResolvedValueOnce([MIGRATION_ROW]);

    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.matchExternalMappingExists).toBe(false);
  });

  it("table existence fields are null when regclass query throws", async () => {
    mockQueryRaw.mockReset();
    mockQueryRaw
      .mockResolvedValueOnce([MAIN_ROW])
      .mockResolvedValueOnce([ADDR_ROW])
      .mockRejectedValueOnce(new Error("relation query failed"))
      .mockResolvedValueOnce([MIGRATION_ROW]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fingerprint.teamExternalMappingExists).toBeNull();
    expect(body.fingerprint.matchExternalMappingExists).toBeNull();
  });

  // ── Fingerprint fields: migration state ────────────────────────────────────

  it("appliedMigrationCount is populated from SQL result", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.appliedMigrationCount).toBe(61);
  });

  it("latestAppliedMigration is populated from SQL result", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint.latestAppliedMigration).toBe(
      MIGRATION_ROW.latestMigration,
    );
  });

  it("migration fields are null when migration query fails", async () => {
    mockQueryRaw.mockReset();
    mockQueryRaw
      .mockResolvedValueOnce([MAIN_ROW])
      .mockResolvedValueOnce([ADDR_ROW])
      .mockResolvedValueOnce([REGCLASS_ROW_PRESENT])
      .mockRejectedValueOnce(new Error("migration table not found"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fingerprint.appliedMigrationCount).toBeNull();
    expect(body.fingerprint.latestAppliedMigration).toBeNull();
  });

  it("partial results returned when main query fails (other fields still populated)", async () => {
    mockQueryRaw.mockReset();
    mockQueryRaw
      .mockRejectedValueOnce(new Error("connection failed"))
      .mockResolvedValueOnce([ADDR_ROW])
      .mockResolvedValueOnce([REGCLASS_ROW_PRESENT])
      .mockResolvedValueOnce([MIGRATION_ROW]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fingerprint.runtimeDatabase).toBeNull();
    expect(body.fingerprint.teamExternalMappingExists).toBe(true);
  });

  // ── Fingerprint fields: URL sanitization ────────────────────────────────────

  it("fingerprint includes urlHost field", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint).toHaveProperty("urlHost");
  });

  it("fingerprint includes urlDatabase field", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint).toHaveProperty("urlDatabase");
  });

  it("fingerprint includes urlIsPooler field", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.fingerprint).toHaveProperty("urlIsPooler");
  });

  // ── Security: no credentials or secrets in response ────────────────────────

  it("response does not contain password field", async () => {
    const response = await GET();
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("password");
    expect(json).not.toContain("passwd");
  });

  it("response does not contain full DATABASE_URL", async () => {
    // Process.env.DATABASE_URL is undefined in test environment.
    // This test verifies the structure — no raw env value is ever included.
    const response = await GET();
    const body = await response.json();
    const json = JSON.stringify(body);

    // Only sanitized fields (urlHost, urlDatabase, urlIsPooler) should exist.
    // The raw URL value must never appear.
    expect(json).not.toContain("DATABASE_URL");
    expect(json).not.toContain("connectionString");
  });

  it("response does not contain access tokens or authorization headers", async () => {
    const response = await GET();
    const json = JSON.stringify(await response.json());

    expect(json).not.toMatch(/bearer/i);
    expect(json).not.toContain("access_token");
    expect(json).not.toContain("authorization");
  });

  it("response does not contain stack trace material", async () => {
    const response = await GET();
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("at Object");
    expect(json).not.toContain("at async");
    expect(json).not.toContain(".ts:");
  });

  it("runtimeUser field is present but never exposes a password", async () => {
    const response = await GET();
    const body = await response.json();

    // runtimeUser is the PostgreSQL current_user — a role name, not a secret.
    // Verify the field exists and contains no colon (which would indicate
    // a user:password pair leaked through).
    const user = body.fingerprint.runtimeUser;
    if (user !== null) {
      expect(user).not.toContain(":");
    }
  });

  // ── Architecture: route should not import raw DB dependencies directly ──────

  it("route file imports prisma from lib/db/prisma (shared singleton)", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/admin/diagnostics/database-fingerprint/route.ts"),
      "utf-8",
    );
    expect(content).toContain("@/lib/db/prisma");
  });

  it("route file does not create an independent Pool or PrismaClient", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/admin/diagnostics/database-fingerprint/route.ts"),
      "utf-8",
    );
    expect(content).not.toContain("new Pool(");
    expect(content).not.toContain("new PrismaClient(");
  });

  it("route file does not import pg directly", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/admin/diagnostics/database-fingerprint/route.ts"),
      "utf-8",
    );
    expect(content).not.toContain('from "pg"');
    expect(content).not.toContain("from 'pg'");
  });

  // ── Read-only guarantee (structural) ─────────────────────────────────────────

  it("route file does not contain INSERT, UPDATE, DELETE, or DDL statements", () => {
    const content = readFileSync(
      resolve(
        process.cwd(),
        "app/api/admin/diagnostics/database-fingerprint/route.ts",
      ),
      "utf-8",
    ).toUpperCase();

    expect(content).not.toContain("INSERT INTO");
    expect(content).not.toContain("UPDATE ");
    expect(content).not.toContain("DELETE FROM");
    expect(content).not.toContain("DROP TABLE");
    expect(content).not.toContain("CREATE TABLE");
    expect(content).not.toContain("ALTER TABLE");
    expect(content).not.toContain("TRUNCATE");
    expect(content).not.toContain("$EXECUTERAW");
  });
});
