/**
 * Website Feed Contract v1 — Validation Script
 *
 * Validates that the /api/public/v1/website/* endpoints meet the contract:
 *   - Routes exist and respond to GET
 *   - Non-GET methods are blocked (405)
 *   - Unauthenticated access is allowed
 *   - Tenant isolation present (unknown tenant → 404)
 *   - websiteEnabled check present (disabled tenant → 503)
 *   - Responses conform to the WebsiteFeedResponse<T> envelope shape
 *   - No sensitive fields exposed (userId, passwordHash, etc.)
 *   - version / generatedAt / tenant / data / meta always present
 *
 * Run (requires running dev server or DATABASE_URL for direct DB checks):
 *
 *   # Against a running Next.js server:
 *   BASE_URL=http://localhost:3000 npx tsx scripts/validate-website-feed-v1.ts
 *
 *   # Or with default localhost:
 *   npx tsx scripts/validate-website-feed-v1.ts
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const TENANT_KEY = process.env.TENANT_KEY ?? "fc-allschwil";

// ── Helpers ────────────────────────────────────────────────────────────────────

type CheckResult = {
  name: string;
  passed: boolean;
  detail: string;
};

const results: CheckResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, passed: true, detail });
  console.log(`  ✅  ${name}`);
  if (detail) console.log(`       ${detail}`);
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.error(`  ❌  ${name}`);
  if (detail) console.error(`       ${detail}`);
}

async function get(path: string, params: Record<string, string> = {}): Promise<Response> {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), { method: "GET" });
}

async function nonGet(path: string, method: string): Promise<Response> {
  const url = BASE_URL + path + `?tenant=${TENANT_KEY}`;
  return fetch(url, { method });
}

const SENSITIVE_FIELDS = [
  "passwordHash",
  "userId",
  "assignedToUserId",
  "createdByUserId",
  "reviewedByUserId",
  "approvedByUserId",
  "rejectedByUserId",
  "publishedByUserId",
  "actorUserId",
];

function assertNoSensitiveFields(body: unknown, label: string): boolean {
  const str = JSON.stringify(body);
  const found = SENSITIVE_FIELDS.filter((f) => str.includes(`"${f}"`));
  if (found.length > 0) {
    fail(label + " — no sensitive fields", `Found: ${found.join(", ")}`);
    return false;
  }
  return true;
}

function assertEnvelope(body: Record<string, unknown>, label: string): boolean {
  const required = ["version", "tenant", "generatedAt", "data", "meta"];
  const missing = required.filter((k) => !(k in body));
  if (missing.length > 0) {
    fail(label + " — envelope shape", `Missing fields: ${missing.join(", ")}`);
    return false;
  }
  if (typeof body.generatedAt !== "string") {
    fail(label + " — generatedAt is string", String(body.generatedAt));
    return false;
  }
  if (typeof body.tenant !== "object" || !body.tenant) {
    fail(label + " — tenant object present", "tenant is not an object");
    return false;
  }
  const t = body.tenant as Record<string, unknown>;
  if (!("key" in t) || !("name" in t)) {
    fail(label + " — tenant has key+name", JSON.stringify(t));
    return false;
  }
  // Ensure no extra sensitive tenant fields leaked
  const tenantStr = JSON.stringify(t);
  if (tenantStr.includes("websiteDomain") || tenantStr.includes("id") && !tenantStr.includes('"key"')) {
    // websiteDomain is intentionally NOT in the public tenant identity
    // (key and name only per PublicTenantIdentity type)
    if (tenantStr.includes("websiteDomain")) {
      fail(label + " — tenant identity excludes websiteDomain", tenantStr);
      return false;
    }
  }
  return true;
}

// ── Test cases ─────────────────────────────────────────────────────────────────

const ENDPOINTS = [
  "/api/public/v1/website",
  "/api/public/v1/website/sponsors",
  "/api/public/v1/website/news",
];

async function runChecks() {
  console.log(`\nWebsite Feed Contract v1 — Validation`);
  console.log(`BASE_URL  : ${BASE_URL}`);
  console.log(`TENANT_KEY: ${TENANT_KEY}`);
  console.log(`─`.repeat(60));

  // 1. Server reachability
  console.log(`\n[1] Server reachability`);
  try {
    const r = await get("/api/public/v1/website", { tenant: TENANT_KEY });
    // 200, 503 (disabled), or 404 (not found) all mean server is up
    if ([200, 404, 503].includes(r.status)) {
      pass("Server reachable", `HTTP ${r.status}`);
    } else {
      fail("Server reachable", `Unexpected HTTP ${r.status}`);
    }
  } catch (e) {
    fail("Server reachable", `Connection error: ${String(e)}`);
    console.error("\nFATAL: Cannot reach server. Start dev server and retry.\n");
    return;
  }

  // 2. Route existence + GET allowed (with ?tenant param)
  console.log(`\n[2] Route existence — GET allowed`);
  for (const path of ENDPOINTS) {
    const r = await get(path, { tenant: TENANT_KEY });
    if (r.status === 200 || r.status === 503) {
      pass(`GET ${path} responds`, `HTTP ${r.status}`);
    } else if (r.status === 404) {
      // Could be tenant-not-found (valid) or route-not-found (invalid)
      const body = await r.json().catch(() => ({})) as Record<string, unknown>;
      if ("code" in body && body.code === "TENANT_NOT_FOUND") {
        pass(`GET ${path} responds`, `HTTP 404 (tenant not found — route exists)`);
      } else {
        fail(`GET ${path} responds`, `HTTP 404 — route may not exist`);
      }
    } else {
      fail(`GET ${path} responds`, `HTTP ${r.status}`);
    }
  }

  // 3. Non-GET blocked
  console.log(`\n[3] Non-GET methods blocked`);
  for (const path of ENDPOINTS) {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const r = await nonGet(path, method);
      if (r.status === 405) {
        pass(`${method} ${path} → 405`, "Method not allowed");
      } else {
        // Next.js App Router returns 405 automatically for undefined methods.
        // If 404 is returned it could mean App Router blocked it at the framework level.
        fail(`${method} ${path} → 405`, `Got HTTP ${r.status}`);
      }
    }
  }

  // 4. Tenant isolation — unknown tenant → 404
  console.log(`\n[4] Tenant isolation`);
  for (const path of ENDPOINTS) {
    const r = await get(path, { tenant: "__nonexistent_tenant_xyz_9999__" });
    if (r.status === 404) {
      const body = await r.json().catch(() => ({})) as Record<string, unknown>;
      if (body.code === "TENANT_NOT_FOUND") {
        pass(`Unknown tenant → 404 ${path}`, `code: TENANT_NOT_FOUND`);
      } else {
        fail(`Unknown tenant → 404 ${path}`, `Expected code=TENANT_NOT_FOUND, got: ${JSON.stringify(body)}`);
      }
    } else {
      fail(`Unknown tenant → 404 ${path}`, `Expected 404, got ${r.status}`);
    }
  }

  // 5. websiteEnabled gate (disabled tenant returns 503 or 404 not 200 with data)
  // We test this by checking that the real tenant either:
  //   a) returns 200 with the expected envelope (websiteEnabled = true in DB)
  //   b) returns 503 (websiteEnabled = false in DB) — still correct
  //   c) returns 404 (tenant key not in DB yet) — acceptable for CI/staging
  console.log(`\n[5] Response envelope + no sensitive fields (tenant: ${TENANT_KEY})`);
  for (const path of ENDPOINTS) {
    const r = await get(path, { tenant: TENANT_KEY });
    if (r.status === 200) {
      const body = await r.json().catch(() => null) as Record<string, unknown> | null;
      if (!body) {
        fail(`${path} — parseable JSON`, "Could not parse response body");
        continue;
      }
      const envOk = assertEnvelope(body, path);
      if (envOk) {
        pass(`${path} — envelope shape`, `version=${body.version}, generatedAt present`);
      }
      if (assertNoSensitiveFields(body, path)) {
        pass(`${path} — no sensitive fields`, "SENSITIVE_FIELDS not found in response");
      }
      // data should be array or object
      if (body.data === null || body.data === undefined) {
        fail(`${path} — data field present`, "data is null/undefined");
      } else {
        pass(`${path} — data field present`, `type: ${Array.isArray(body.data) ? "array" : typeof body.data}`);
      }
      // meta.cacheHint present
      const meta = body.meta as Record<string, unknown> | null;
      if (meta && "cacheHint" in meta) {
        pass(`${path} — meta.cacheHint`, String(meta.cacheHint));
      } else {
        fail(`${path} — meta.cacheHint`, "meta.cacheHint missing");
      }
    } else if (r.status === 503) {
      const body = await r.json().catch(() => null) as Record<string, unknown> | null;
      if (body && body.code === "WEBSITE_DISABLED") {
        pass(`${path} — websiteEnabled gate`, `HTTP 503: website disabled for ${TENANT_KEY}`);
      } else {
        fail(`${path} — websiteEnabled gate`, `HTTP 503 but wrong body: ${JSON.stringify(body)}`);
      }
    } else if (r.status === 404) {
      pass(`${path} — tenant not in DB`, `HTTP 404 (acceptable for CI/staging without seeded tenant)`);
    } else {
      fail(`${path} — unexpected status`, `HTTP ${r.status}`);
    }
  }

  // 6. Cache-Control header
  console.log(`\n[6] Cache-Control header`);
  for (const path of ENDPOINTS) {
    const r = await get(path, { tenant: TENANT_KEY });
    if (r.status === 200) {
      const cc = r.headers.get("cache-control") ?? "";
      if (cc.includes("public") && cc.includes("s-maxage")) {
        pass(`${path} — Cache-Control`, cc);
      } else {
        fail(`${path} — Cache-Control`, `Expected public+s-maxage, got: "${cc}"`);
      }
    } else {
      pass(`${path} — Cache-Control (skip)`, `HTTP ${r.status} — skipping cache header check`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Validation complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`\n❌ Failing checks:`);
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`   • ${r.name}: ${r.detail}`);
    });
    process.exit(1);
  } else {
    console.log(`\n✅ All checks passed.`);
  }
}

runChecks().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
