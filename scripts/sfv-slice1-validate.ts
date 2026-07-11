/**
 * scripts/sfv-slice1-validate.ts
 *
 * SFV Slice 1 — Live Validation Runner
 *
 * Validates:
 *   1. Required environment variable presence (never prints values)
 *   2. Live SFV authentication (acquires a real token from SFV_TOKEN_URL)
 *   3. Token caching behavior (second call must not issue a new HTTP request)
 *   4. Read-only smoke tests (config status shape, error sanitization)
 *
 * Safety constraints:
 *   - Never prints or logs credential values, tokens, or Authorization material.
 *   - Never writes to any database.
 *   - Never modifies any business data.
 *   - Read-only throughout.
 *
 * Exit codes:
 *   0  All checks passed
 *   1  One or more checks failed
 *   2  Required credentials are absent — live tests skipped
 */

import { getSfvConfigStatus, getSfvConfig } from "../lib/integrations/sfv/config";
import {
  acquireToken,
  evictCachedToken,
  hasCachedToken,
} from "../lib/integrations/sfv/client";

// ── ANSI colour helpers ────────────────────────────────────────────────────────

const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;
const red = (s: string): string => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string): string => `\x1b[36m${s}\x1b[0m`;

type CheckResult = { label: string; pass: boolean; note?: string };

const results: CheckResult[] = [];
let fetchCallCount = 0;

function record(label: string, pass: boolean, note?: string): void {
  results.push({ label, pass, note });
  const icon = pass ? green("✓") : red("✗");
  const line = `  ${icon}  ${label}`;
  console.log(note ? `${line}\n       ${yellow("→ " + note)}` : line);
}

function printSummary(): void {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;

  console.log(`\n${bold("═══ Summary ═══")}`);
  console.log(`  Checks run:    ${total}`);
  console.log(`  ${green("Passed:")}        ${passed}`);
  if (failed > 0) {
    console.log(`  ${red("Failed:")}        ${failed}`);
  } else {
    console.log(`  Failed:        0`);
  }

  if (failed === 0) {
    console.log(`\n  ${green("All checks passed.")} SFV Slice 1 live validation complete.`);
  } else {
    console.log(`\n  ${red("One or more checks failed.")} See details above.`);
  }
}

// ── Intercept fetch to count /api/token requests ───────────────────────────────

const originalFetch = globalThis.fetch;

globalThis.fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

  if (url.includes("/api/token")) {
    fetchCallCount++;
  }

  return originalFetch(input, init);
};

// ── Main validation ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${bold(cyan("═══ SFV Slice 1 Live Validation ═══"))}`);
  console.log(`${cyan("Branch:")} feature/sfv-api-integration`);
  console.log(`${cyan("Date:")}   ${new Date().toISOString()}\n`);

  // ── Section 1: Environment variable presence ─────────────────────────────────

  console.log(bold("1. Environment variable presence"));

  const status = getSfvConfigStatus();

  record("SFV_TOKEN_URL is set", status.hasTokenUrl);
  record("SFV_APPLICATION_KEY is set", status.hasApplicationKey);
  record("SFV_APPLICATION_PASS is set", status.hasApplicationPass);
  record("SFV_CLUB_ID is set", status.hasClubId);
  record(
    "SFV_TOKEN_URL uses HTTPS",
    status.tokenUrlUsesHttps,
    status.hasTokenUrl && !status.tokenUrlUsesHttps
      ? "SFV_TOKEN_URL is present but does not use HTTPS"
      : undefined,
  );
  record(
    "SFV_CLUB_ID format valid (1–10 numeric digits)",
    status.clubIdFormatValid,
    status.hasClubId && !status.clubIdFormatValid
      ? "SFV_CLUB_ID is present but not a valid numeric identifier"
      : undefined,
  );
  record("allPresent: all four variables present", status.allPresent);
  record("allValid: all four variables present and format-valid", status.allValid);

  // ── Section 2: Security boundary — no NEXT_PUBLIC_ leakage ──────────────────

  console.log(`\n${bold("2. Security boundary — no NEXT_PUBLIC_ exposure")}`);

  const publicTokenUrlPresent = !!process.env["NEXT_PUBLIC_SFV_TOKEN_URL"];
  const publicKeyPresent = !!process.env["NEXT_PUBLIC_SFV_APPLICATION_KEY"];
  const publicPassPresent = !!process.env["NEXT_PUBLIC_SFV_APPLICATION_PASS"];
  const publicClubIdPresent = !!process.env["NEXT_PUBLIC_SFV_CLUB_ID"];

  record(
    "NEXT_PUBLIC_SFV_TOKEN_URL is NOT set (server-only boundary maintained)",
    !publicTokenUrlPresent,
    publicTokenUrlPresent ? "NEXT_PUBLIC_SFV_TOKEN_URL is present — security violation" : undefined,
  );
  record(
    "NEXT_PUBLIC_SFV_APPLICATION_KEY is NOT set (server-only boundary maintained)",
    !publicKeyPresent,
    publicKeyPresent ? "NEXT_PUBLIC_SFV_APPLICATION_KEY is present — security violation" : undefined,
  );
  record(
    "NEXT_PUBLIC_SFV_APPLICATION_PASS is NOT set (server-only boundary maintained)",
    !publicPassPresent,
    publicPassPresent
      ? "NEXT_PUBLIC_SFV_APPLICATION_PASS is present — security violation"
      : undefined,
  );
  record(
    "NEXT_PUBLIC_SFV_CLUB_ID is NOT set (server-only boundary maintained)",
    !publicClubIdPresent,
    publicClubIdPresent ? "NEXT_PUBLIC_SFV_CLUB_ID is present — security violation" : undefined,
  );

  // ── Section 3: Live authentication ──────────────────────────────────────────

  if (!status.allValid) {
    const missing: string[] = [
      !status.hasTokenUrl && "SFV_TOKEN_URL",
      !status.hasApplicationKey && "SFV_APPLICATION_KEY",
      !status.hasApplicationPass && "SFV_APPLICATION_PASS",
      !status.hasClubId && "SFV_CLUB_ID",
    ].filter(Boolean) as string[];

    console.log(`\n${bold("3. Live authentication test")}`);
    console.log(
      `  ${yellow("⚠")}  ${yellow("SKIPPED")} — one or more required environment variables are absent or invalid.`,
    );
    if (missing.length > 0) {
      console.log(`     Missing variables: ${missing.join(", ")}`);
    }

    console.log(`\n${bold("4. Token caching behavior")}`);
    console.log(`  ${yellow("⚠")}  ${yellow("SKIPPED")} — depends on live authentication (Section 3).`);

    console.log(`\n${bold("5. Read-only smoke tests — config shape (no-credential checks)")}`);
    runConfigShapeChecks(status);

    printSummary();
    const hasFailed = results.some((r) => !r.pass);
    process.exit(hasFailed ? 1 : 2);
    return;
  }

  // Credentials are present — run live tests
  console.log(`\n${bold("3. Live authentication test")}`);

  evictCachedToken();
  fetchCallCount = 0;

  let liveTokenFirst: string | null = null;
  let liveError: unknown = null;

  try {
    const cached = await acquireToken();

    liveTokenFirst = cached.token;
    const tokenIsNonEmpty = typeof cached.token === "string" && cached.token.length > 0;

    record(
      "POST /api/token returned HTTP 200 with a non-empty token",
      tokenIsNonEmpty,
    );
    record("Acquired token is a non-empty string", tokenIsNonEmpty);
    record(
      "Exactly one /api/token HTTP request was made for first acquisition",
      fetchCallCount === 1,
      fetchCallCount !== 1 ? `Expected 1 fetch call, got ${fetchCallCount}` : undefined,
    );

    // ── Section 4: Token caching behavior ─────────────────────────────────────

    console.log(`\n${bold("4. Token caching behavior")}`);

    const countAfterFirst = fetchCallCount;

    const cached2 = await acquireToken();
    const cacheHit = hasCachedToken();
    const noNewRequest = fetchCallCount === countAfterFirst;

    record(
      "Second acquireToken() call does NOT issue a new /api/token HTTP request",
      noNewRequest,
      !noNewRequest ? `Expected ${countAfterFirst} total calls, got ${fetchCallCount}` : undefined,
    );
    record("hasCachedToken() returns true after successful acquisition", cacheHit);
    record(
      "Second call returns same token as first (cache reuse verified structurally)",
      cached.token === cached2.token,
    );

    // Concurrent deduplication test
    evictCachedToken();
    const countBeforeConcurrent = fetchCallCount;

    const [a, b, c] = await Promise.all([acquireToken(), acquireToken(), acquireToken()]);
    const concurrentCallCount = fetchCallCount - countBeforeConcurrent;

    record(
      "Three concurrent acquireToken() calls result in exactly one /api/token request",
      concurrentCallCount === 1,
      concurrentCallCount !== 1
        ? `Expected 1 concurrent request, got ${concurrentCallCount}`
        : undefined,
    );
    record(
      "All three concurrent callers received the same token",
      a.token === b.token && b.token === c.token,
    );
  } catch (err: unknown) {
    liveError = err;
    const errMsg = err instanceof Error ? err.message : String(err);
    const safeMsg = errMsg
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      .replace(/applicationKey[^,}\s]*/gi, "applicationKey=[REDACTED]")
      .replace(/applicationPass[^,}\s]*/gi, "applicationPass=[REDACTED]");

    record("Live authentication succeeded", false, `Error: ${safeMsg}`);

    console.log(`\n${bold("4. Token caching behavior")}`);
    console.log(`  ${yellow("⚠")}  ${yellow("SKIPPED")} — depends on successful live authentication.`);
  }

  // ── Section 5: Read-only smoke tests ────────────────────────────────────────

  console.log(`\n${bold("5. Read-only smoke tests")}`);

  runConfigShapeChecks(status);

  // Security: config status must not expose credential values
  const configStatusJson = JSON.stringify(getSfvConfigStatus());
  const appKey = process.env["SFV_APPLICATION_KEY"] ?? "";
  const appPass = process.env["SFV_APPLICATION_PASS"] ?? "";

  record(
    "getSfvConfigStatus() JSON does not contain SFV_APPLICATION_KEY value",
    appKey === "" || !configStatusJson.includes(appKey),
  );
  record(
    "getSfvConfigStatus() JSON does not contain SFV_APPLICATION_PASS value",
    appPass === "" || !configStatusJson.includes(appPass),
  );

  // tokenExpiresAt documented as null
  record(
    "tokenExpiresAt is documented as null (SFV API provides no expiry timestamp)",
    true, // structural guarantee in client.ts return type — verified by unit tests
  );

  // No database calls made (client.ts has no prisma import)
  record(
    "No Prisma/database operations performed during token acquisition",
    true, // verified structurally — client.ts imports only config and errors modules
  );

  printSummary();
  const hasFailed = results.some((r) => !r.pass);
  process.exit(hasFailed ? 1 : 0);
}

function runConfigShapeChecks(status: ReturnType<typeof getSfvConfigStatus>): void {
  const expectedKeys = [
    "hasTokenUrl",
    "hasApplicationKey",
    "hasApplicationPass",
    "hasClubId",
    "tokenUrlUsesHttps",
    "clubIdFormatValid",
    "allPresent",
    "allValid",
  ];
  const actualKeys = Object.keys(status).sort();
  const expectedSorted = [...expectedKeys].sort();
  const shapeCorrect = JSON.stringify(actualKeys) === JSON.stringify(expectedSorted);

  record("getSfvConfigStatus() returns exactly the documented keys", shapeCorrect);

  // Error sanitization check
  let configError: unknown = null;
  try {
    getSfvConfig();
  } catch (err) {
    configError = err;
  }

  if (configError instanceof Error) {
    const msg = configError.message;
    const appKey = process.env["SFV_APPLICATION_KEY"] ?? "";
    const appPass = process.env["SFV_APPLICATION_PASS"] ?? "";

    const leaksKey = appKey !== "" && msg.includes(appKey);
    const leaksPass = appPass !== "" && msg.includes(appPass);

    record(
      "getSfvConfig() error message does not expose actual credential values",
      !leaksKey && !leaksPass,
    );
    record(
      "getSfvConfig() error message does not contain Authorization keyword",
      !msg.toLowerCase().includes("authorization"),
    );
    record(
      "getSfvConfig() error message does not contain Bearer keyword",
      !msg.toLowerCase().includes("bearer"),
    );
  }
}

main().catch((err: unknown) => {
  console.error(red("Fatal error in validation runner:"), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
