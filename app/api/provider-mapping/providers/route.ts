/**
 * GET /api/provider-mapping/providers
 *
 * Returns the list of registered provider adapters.
 * Used by the admin UI to populate the provider selector.
 *
 * Authorization: TEAMS_MANAGE.
 *
 * Response:
 *   { providers: string[] }  — e.g. ["SFV"]
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRegisteredProviders } from "@/lib/provider-mapping/provider-registry";
import { ensureSfvAdapterRegistered } from "@/lib/integrations/sfv/register-adapter";

export const dynamic = "force-dynamic";

ensureSfvAdapterRegistered();

export async function GET(): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const providers = getRegisteredProviders();
  return NextResponse.json({ providers });
}
