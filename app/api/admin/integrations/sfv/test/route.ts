/**
 * POST /api/admin/integrations/sfv/test
 *
 * Admin-only SFV connection test endpoint.
 *
 * Tests the SFV / ClubCorner authentication by acquiring a token from the
 * configured SFV_TOKEN_URL. Returns a sanitized result — never exposes tokens,
 * credentials, Authorization headers, or raw upstream response payloads.
 *
 * Authorization: requires TENANTS_MANAGE permission.
 * Tenant isolation: uses session-carried tenantId (existing mechanism).
 *
 * Slice 1 constraints:
 *   - No database writes (no history persistence, no audit entry).
 *   - No SFV data import or business-data mutation.
 *   - Connection test result is returned in the response only; not persisted.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getSfvConfigStatus } from "@/lib/integrations/sfv/config";
import { testSfvConnection } from "@/lib/integrations/sfv/client";
import { getRuntimeEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const configStatus = getSfvConfigStatus();

  if (!configStatus.allValid) {
    const missing: string[] = [];

    if (!configStatus.hasTokenUrl) missing.push("SFV_TOKEN_URL");
    if (!configStatus.hasApplicationKey) missing.push("SFV_APPLICATION_KEY");
    if (!configStatus.hasApplicationPass) missing.push("SFV_APPLICATION_PASS");
    if (!configStatus.hasClubId) missing.push("SFV_CLUB_ID");

    const invalid: string[] = [];

    if (configStatus.hasTokenUrl && !configStatus.tokenUrlUsesHttps) {
      invalid.push("SFV_TOKEN_URL (must use HTTPS)");
    }

    if (configStatus.hasClubId && !configStatus.clubIdFormatValid) {
      invalid.push("SFV_CLUB_ID (must be numeric)");
    }

    return NextResponse.json(
      {
        connected: false,
        configurationValid: false,
        missingVariables: missing,
        invalidVariables: invalid,
        testedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  const env = getRuntimeEnvironment();
  const connectionResult = await testSfvConnection();

  return NextResponse.json(
    {
      connected: connectionResult.connected,
      configurationValid: true,
      environment: env.appEnv,
      clubIdConfigured: configStatus.hasClubId && configStatus.clubIdFormatValid,
      tokenValid: connectionResult.tokenValid,
      tokenExpiresAt: connectionResult.tokenExpiresAt,
      testedAt: connectionResult.testedAt,
      error: connectionResult.error,
    },
    { status: connectionResult.connected ? 200 : 502 },
  );
}
