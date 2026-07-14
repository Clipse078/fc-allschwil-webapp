/**
 * GET /api/admin/diagnostics/database-fingerprint
 *
 * Temporary forensic endpoint — fingerprints the exact Prisma runtime
 * database connection to diagnose the "public.TeamExternalMapping does not
 * exist" discrepancy between local Prisma Studio and the deployed Vercel
 * runtime.
 *
 * Authorization: requires authenticated session + TENANTS_MANAGE permission.
 * Tenant isolation: tenantId is resolved from the authenticated session.
 *
 * Safety contract:
 *   - No credentials, passwords, full connection strings, or usernames are
 *     returned. Only the hostname and database name are extracted from
 *     DATABASE_URL (never the userinfo portion).
 *   - All SQL is read-only (SELECT only). No mutations occur.
 *   - Uses the shared prisma singleton from lib/db/prisma — the identical
 *     connection used by the failing sync endpoints.
 *   - inet_server_addr() is attempted but silently omitted on failure (some
 *     Neon pooler configurations do not expose it).
 *
 * HTTP status mapping:
 *   200  — fingerprint returned (partial results on SQL failure)
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context in session
 *   500  — unexpected internal error (no internal details exposed)
 *
 * TODO: Remove this endpoint once the table-existence discrepancy is
 * diagnosed and resolved.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// URL sanitizer — extracts only host and database, never credentials.
// ---------------------------------------------------------------------------

type SanitizedUrl = {
  host: string | null;
  database: string | null;
  isPooler: boolean | null;
};

function sanitizeDatabaseUrl(rawUrl: string | undefined): SanitizedUrl {
  if (!rawUrl) {
    return { host: null, database: null, isPooler: null };
  }

  try {
    const url = new URL(rawUrl);
    const host = url.hostname || null;
    // pathname is "/<dbname>" or just "/" — strip leading slash.
    const dbPath = url.pathname.replace(/^\//, "");
    const database = dbPath.length > 0 ? dbPath : null;
    const isPooler = host !== null && host.includes("-pooler");
    return { host, database, isPooler };
  } catch {
    return { host: null, database: null, isPooler: null };
  }
}

// ---------------------------------------------------------------------------
// Row shapes for typed $queryRaw results
// ---------------------------------------------------------------------------

type MainRow = {
  runtimeDatabase: string;
  runtimeSchema: string;
  runtimeUser: string;
  runtimeVersion: string;
};

type AddrRow = {
  serverAddr: string | null;
};

type RegclassRow = {
  teamExternalMapping: string | null;
  matchExternalMapping: string | null;
};

type MigrationRow = {
  migrationCount: bigint;
  latestMigration: string | null;
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  // ── 1. Authenticate and authorize ─────────────────────────────────────────
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // ── 2. Require tenant context ──────────────────────────────────────────────
  const tenantId = access.session.user.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context missing from session" },
      { status: 403 },
    );
  }

  // ── 3. Sanitize DATABASE_URL — hostname and db name only, never credentials
  const urlInfo = sanitizeDatabaseUrl(process.env.DATABASE_URL);

  // ── 4. Read-only SQL queries via the shared Prisma connection ──────────────
  //
  // Each query is isolated in its own try/catch so that a single failure does
  // not prevent the other fingerprint fields from being returned.

  let runtimeDatabase: string | null = null;
  let runtimeSchema: string | null = null;
  let runtimeUser: string | null = null;
  let runtimeVersion: string | null = null;

  try {
    const rows = await prisma.$queryRaw<MainRow[]>`
      SELECT
        current_database() AS "runtimeDatabase",
        current_schema()   AS "runtimeSchema",
        current_user       AS "runtimeUser",
        version()          AS "runtimeVersion"
    `;

    if (rows.length > 0) {
      runtimeDatabase = rows[0].runtimeDatabase ?? null;
      runtimeSchema = rows[0].runtimeSchema ?? null;
      runtimeUser = rows[0].runtimeUser ?? null;
      runtimeVersion = rows[0].runtimeVersion ?? null;
    }
  } catch (e) {
    console.error("[db-fingerprint] Main connection query failed:", e);
  }

  // inet_server_addr() is not available behind some Neon poolers — silently
  // null on failure.
  let runtimeServerAddr: string | null = null;

  try {
    const rows = await prisma.$queryRaw<AddrRow[]>`
      SELECT inet_server_addr()::text AS "serverAddr"
    `;
    runtimeServerAddr = rows[0]?.serverAddr ?? null;
  } catch {
    runtimeServerAddr = null;
  }

  // to_regclass returns NULL when the relation does not exist in the current
  // search_path (or in the explicitly qualified schema).
  let teamExternalMappingExists: boolean | null = null;
  let matchExternalMappingExists: boolean | null = null;

  try {
    const rows = await prisma.$queryRaw<RegclassRow[]>`
      SELECT
        to_regclass('public."TeamExternalMapping"')::text  AS "teamExternalMapping",
        to_regclass('public."MatchExternalMapping"')::text AS "matchExternalMapping"
    `;

    if (rows.length > 0) {
      teamExternalMappingExists = rows[0].teamExternalMapping !== null;
      matchExternalMappingExists = rows[0].matchExternalMapping !== null;
    }
  } catch (e) {
    console.error("[db-fingerprint] Table-existence query failed:", e);
  }

  // Migration state — counts rows where the migration completed successfully
  // (finished_at IS NOT NULL AND rolled_back_at IS NULL).
  let appliedMigrationCount: number | null = null;
  let latestAppliedMigration: string | null = null;

  try {
    const rows = await prisma.$queryRaw<MigrationRow[]>`
      SELECT
        COUNT(*)           AS "migrationCount",
        MAX(migration_name) AS "latestMigration"
      FROM public._prisma_migrations
      WHERE finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `;

    if (rows.length > 0) {
      appliedMigrationCount =
        rows[0].migrationCount !== undefined && rows[0].migrationCount !== null
          ? Number(rows[0].migrationCount)
          : null;
      latestAppliedMigration = rows[0].latestMigration ?? null;
    }
  } catch (e) {
    console.error("[db-fingerprint] Migration query failed:", e);
  }

  return NextResponse.json({
    fingerprint: {
      // ── Derived from DATABASE_URL (no credentials) ────────────────────────
      urlHost: urlInfo.host,
      urlDatabase: urlInfo.database,
      urlIsPooler: urlInfo.isPooler,

      // ── From runtime SQL ──────────────────────────────────────────────────
      runtimeDatabase,
      runtimeSchema,
      runtimeUser,
      runtimeVersion,
      runtimeServerAddr,

      // ── Table existence ───────────────────────────────────────────────────
      // null means the query itself failed (not that the table is missing).
      teamExternalMappingExists,
      matchExternalMappingExists,

      // ── Migration state ───────────────────────────────────────────────────
      appliedMigrationCount,
      latestAppliedMigration,
    },
    timestamp: new Date().toISOString(),
  });
}
