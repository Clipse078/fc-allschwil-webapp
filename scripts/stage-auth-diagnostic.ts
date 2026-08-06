/**
 * scripts/stage-auth-diagnostic.ts
 *
 * READ-ONLY STAGE auth diagnostic.
 *
 * SAFETY INVARIANT:
 *   This script executes ONLY SELECT statements.
 *   It NEVER writes, updates, deletes, or alters any row.
 *   It NEVER prints passwordHash, NEXTAUTH_SECRET, or any DB credential value.
 *   It is safe to run against STAGE or PROD at any time.
 *
 * Uses raw node-postgres (pg) — no Prisma generation required.
 *
 * Checks:
 *   1. DATABASE_URL — which DB is targeted (host/db printed, password masked)
 *   2. admin@fcallschwil.ch — user row existence
 *   3. User isActive flag
 *   4. passwordHash present and non-empty (value NOT printed, only bcrypt prefix)
 *   5. Tenant membership — tenantId + fc-allschwil key + tenant status
 *   6. Role assignment — at least one UserRole row
 *   7. NEXTAUTH_SECRET — env var presence (value NOT printed)
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npx tsx scripts/stage-auth-diagnostic.ts
 *
 * With .env / .env.local (auto-loaded):
 *   npx tsx scripts/stage-auth-diagnostic.ts
 */

import "dotenv/config";
import { Client } from "pg";

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

type CheckResult = {
  id: string;
  description: string;
  status: CheckStatus;
  detail: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_DETAIL = 100;

function truncate(s: string, max = MAX_DETAIL): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function maskConnectionString(url: string | undefined): string {
  if (!url) return "(not set)";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port ? `:${parsed.port}` : "";
    const db = parsed.pathname;
    const user = parsed.username || "(no user)";
    const sp = parsed.searchParams.toString();
    return `${parsed.protocol}//${user}:***@${host}${port}${db}${sp ? `?${sp}` : ""}`;
  } catch {
    return url.replace(/:[^@/]*@/, ":***@");
  }
}

function inferEnv(url: string | undefined): string {
  if (!url) return "UNKNOWN";
  const l = url.toLowerCase();
  if (l.includes("stage")) return "STAGE";
  if (l.includes("prod")) return "PROD";
  if (l.includes("localhost") || l.includes("127.0.0.1")) return "LOCAL";
  return "EXTERNAL";
}

// ── Table renderer ────────────────────────────────────────────────────────────

function renderTable(results: CheckResult[]): void {
  const details = results.map((r) => truncate(r.detail));

  const w = {
    id: Math.max(4, ...results.map((r) => r.id.length)),
    desc: Math.max(11, ...results.map((r) => r.description.length)),
    status: 8,
    detail: Math.max(6, ...details.map((d) => d.length)),
  };

  const line = (
    id: string,
    desc: string,
    status: string,
    detail: string
  ): string =>
    `│ ${id.padEnd(w.id)} │ ${desc.padEnd(w.desc)} │ ${status.padEnd(w.status)} │ ${detail.padEnd(w.detail)} │`;

  const hr = (tl: string, tm: string, tr: string, h: string): string =>
    `${tl}${h.repeat(w.id + 2)}${tm}${h.repeat(w.desc + 2)}${tm}${h.repeat(w.status + 2)}${tm}${h.repeat(w.detail + 2)}${tr}`;

  console.log(hr("┌", "┬", "┐", "─"));
  console.log(line("#", "Description", "Status", "Detail"));
  console.log(hr("├", "┼", "┤", "─"));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const label =
      r.status === "PASS"
        ? "✅ PASS"
        : r.status === "FAIL"
          ? "❌ FAIL"
          : r.status === "WARN"
            ? "⚠️  WARN"
            : "⏭  SKIP";
    console.log(line(r.id, r.description, label, details[i]));
  }

  console.log(hr("└", "┴", "┘", "─"));
}

function printSummary(results: CheckResult[]): void {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const skip = results.filter((r) => r.status === "SKIP").length;

  console.log("");
  console.log(
    `  Summary: ✅ ${pass} PASS  ❌ ${fail} FAIL  ⚠️  ${warn} WARN  ⏭  ${skip} SKIP`,
  );

  if (fail > 0) {
    console.log(
      "  ❌ AUTH DIAGNOSTIC: FAIL — one or more critical checks failed.",
    );
  } else if (warn > 0) {
    console.log(
      "  ⚠️  AUTH DIAGNOSTIC: WARN — review warnings before going live.",
    );
  } else if (skip > 0) {
    console.log(
      "  ⏭  AUTH DIAGNOSTIC: INCOMPLETE — rerun with a valid DATABASE_URL.",
    );
  } else {
    console.log("  ✅ AUTH DIAGNOSTIC: ALL CHECKS PASSED.");
  }
  console.log("");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const TARGET_EMAIL = "admin@fcallschwil.ch";
  const TARGET_TENANT_KEY = "fc-allschwil";

  const results: CheckResult[] = [];

  console.log(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  console.log("  STAGE AUTH DIAGNOSTIC — READ-ONLY");
  console.log("  Target: " + TARGET_EMAIL);
  console.log("  Run at: " + new Date().toISOString());
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
  );

  // ── Check 1: DATABASE_URL ──────────────────────────────────────────────────

  const dbUrl = process.env.DATABASE_URL?.trim();
  const maskedUrl = maskConnectionString(dbUrl);
  const envLabel = inferEnv(dbUrl);

  results.push({
    id: "1",
    description: "DATABASE_URL set",
    status: dbUrl ? "PASS" : "FAIL",
    detail: dbUrl
      ? `${envLabel} — ${maskedUrl}`
      : "Env var not set — cannot connect",
  });

  if (!dbUrl) {
    for (const [id, desc] of Object.entries(SKIP_DESCS)) {
      results.push({ id, description: desc, status: "SKIP", detail: "No DATABASE_URL" });
    }
    results.push({
      id: "7",
      description: "NEXTAUTH_SECRET set",
      status: "SKIP",
      detail: "No DATABASE_URL",
    });
    renderTable(results);
    printSummary(results);
    return;
  }

  // ── Connect (read-only) ───────────────────────────────────────────────────

  const client = new Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 8000,
    ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (err) {
    const errObj = err instanceof Error ? err : null;
    const raw =
      errObj?.message ||
      (errObj as NodeJS.ErrnoException | null)?.code ||
      (err ? String(err) : "connection error");
    const msg =
      raw.split("\n").find((l) => l.trim().length > 0) ??
      "connection error";
    results.push({
      id: "DB",
      description: "DB connection",
      status: "FAIL",
      detail: truncate(msg),
    });
    for (const [id, desc] of Object.entries(SKIP_DESCS)) {
      results.push({ id, description: desc, status: "SKIP", detail: "Connection failed" });
    }
    results.push(check7());
    renderTable(results);
    printSummary(results);
    return;
  }

  try {
    // ── Check 2–6: single query ───────────────────────────────────────────────
    // Joins users → tenants + counts roles.
    // passwordHash is fetched only for length/prefix check; value never printed.

    // RPERM-04: tenant membership is checked via the canonical TenantMembership
    // table (an active row for TARGET_TENANT_KEY), never via the legacy
    // User.tenantId column, which is no longer written for new users.
    const { rows } = await client.query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      is_active: boolean;
      password_hash: string | null;
      last_login_at: Date | null;
      tenant_id: string | null;
      tenant_key: string | null;
      tenant_name: string | null;
      tenant_status: string | null;
      membership_active: boolean | null;
      role_count: string;
      role_keys: string;
    }>(
      `
      SELECT
        u.id,
        u.email,
        u."firstName"    AS first_name,
        u."lastName"     AS last_name,
        u."isActive"     AS is_active,
        u."passwordHash" AS password_hash,
        u."lastLoginAt"  AS last_login_at,
        t.id             AS tenant_id,
        t.key            AS tenant_key,
        t.name           AS tenant_name,
        t.status         AS tenant_status,
        tm."isActive"    AS membership_active,
        COUNT(ur.id)::text                        AS role_count,
        COALESCE(STRING_AGG(r.key, ', '), '')     AS role_keys
      FROM "User" u
      LEFT JOIN "Tenant"           t  ON t.key = $2
      LEFT JOIN "TenantMembership" tm ON tm."userId" = u.id AND tm."tenantId" = t.id
      LEFT JOIN "UserRole"         ur ON ur."userId" = u.id
      LEFT JOIN "Role"             r  ON r.id = ur."roleId"
      WHERE u.email = $1
      GROUP BY u.id, t.id, tm."isActive"
      `,
      [TARGET_EMAIL, TARGET_TENANT_KEY],
    );

    const user = rows[0] ?? null;

    // ── Check 2: exists ──────────────────────────────────────────────────────

    results.push({
      id: "2",
      description: "User exists",
      status: user ? "PASS" : "FAIL",
      detail: user
        ? `${user.first_name} ${user.last_name} (id: ${user.id.slice(0, 12)}…)`
        : `No row found for ${TARGET_EMAIL}`,
    });

    if (!user) {
      for (const [id, desc] of Object.entries(SKIP_DESCS).filter(([k]) => k !== "2")) {
        results.push({ id, description: desc, status: "SKIP", detail: "User not found" });
      }
    } else {
      // ── Check 3: isActive ──────────────────────────────────────────────────

      const loginStr = user.last_login_at
        ? `lastLogin: ${user.last_login_at.toISOString().slice(0, 16)}`
        : "never logged in";

      results.push({
        id: "3",
        description: "User isActive",
        status: user.is_active ? "PASS" : "FAIL",
        detail: user.is_active
          ? `isActive = true  |  ${loginStr}`
          : `isActive = false — login will be rejected  |  ${loginStr}`,
      });

      // ── Check 4: passwordHash ──────────────────────────────────────────────

      const hash = user.password_hash ?? "";
      const hashPresent = hash.length > 0;
      const hashBcrypt =
        hash.startsWith("$2b$") || hash.startsWith("$2a$") || hash.startsWith("$2y$");
      const hashPrefix = hashPresent ? hash.slice(0, 7) + "…" : "(empty)";

      results.push({
        id: "4",
        description: "passwordHash set",
        status: hashPresent ? (hashBcrypt ? "PASS" : "WARN") : "FAIL",
        detail: hashPresent
          ? hashBcrypt
            ? `bcrypt hash present  |  prefix: ${hashPrefix}  |  length: ${hash.length}`
            : `Hash present but unexpected format: ${hashPrefix} (expected $2b$…)`
          : "passwordHash is empty/null — authentication will fail",
      });

      // ── Check 5: tenant membership (RPERM-04: TenantMembership, not User.tenantId) ──

      if (!user.tenant_id) {
        results.push({
          id: "5",
          description: "Tenant membership",
          status: "FAIL",
          detail: `Tenant "${TARGET_TENANT_KEY}" not found`,
        });
      } else if (!user.membership_active) {
        results.push({
          id: "5",
          description: "Tenant membership",
          status: "FAIL",
          detail: "No active TenantMembership row — tenant context will not resolve",
        });
      } else {
        const active = user.tenant_status === "ACTIVE";
        results.push({
          id: "5",
          description: "Tenant membership",
          status: active ? "PASS" : "WARN",
          detail: active
            ? `${user.tenant_name} (key: ${user.tenant_key}) — ACTIVE membership`
            : `${user.tenant_name} (key: ${user.tenant_key}) — tenant status: ${user.tenant_status}`,
        });
      }

      // ── Check 6: role assignment ───────────────────────────────────────────

      const roleCount = parseInt(user.role_count, 10);

      results.push({
        id: "6",
        description: "Role assignment",
        status: roleCount > 0 ? "PASS" : "WARN",
        detail: roleCount > 0
          ? `${roleCount} role(s): ${user.role_keys}`
          : "No UserRole rows — user has no assigned roles",
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const firstLine = msg.split("\n").find((l) => l.trim().length > 0) ?? msg;
    results.push({
      id: "2–6",
      description: "DB query (checks 2–6)",
      status: "FAIL",
      detail: truncate(firstLine),
    });
    for (const [id, desc] of Object.entries(SKIP_DESCS)) {
      if (!results.find((r) => r.id === id)) {
        results.push({ id, description: desc, status: "SKIP", detail: "Query failed" });
      }
    }
  } finally {
    await client.end().catch(() => null);
  }

  // ── Check 7: NEXTAUTH_SECRET ──────────────────────────────────────────────

  results.push(check7());

  renderTable(results);
  printSummary(results);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIP_DESCS: Record<string, string> = {
  "2": "User exists",
  "3": "User isActive",
  "4": "passwordHash set",
  "5": "Tenant membership",
  "6": "Role assignment",
};

function check7(): CheckResult {
  const secret = process.env.NEXTAUTH_SECRET;
  const len = secret?.length ?? 0;
  const present = len >= 16;
  return {
    id: "7",
    description: "NEXTAUTH_SECRET set",
    status: present ? "PASS" : secret !== undefined ? "WARN" : "FAIL",
    detail: present
      ? `Set — ${len} chars (value hidden)`
      : secret !== undefined
        ? `Set but only ${len} chars — may be a placeholder (min 16 recommended)`
        : "Not set in current environment",
  };
}

// ── Entry ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("\n[FATAL]", err instanceof Error ? err.message : err);
  process.exit(1);
});
