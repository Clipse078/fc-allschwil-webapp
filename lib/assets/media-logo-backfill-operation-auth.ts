/**
 * lib/assets/media-logo-backfill-operation-auth.ts
 *
 * TEMPORARY MEDIA-LOGO-01 operational auth helpers.
 * Remove after successful backfill verification before STAGE merge.
 */

import { MEDIA_LOGO_BACKFILL_TENANT_KEY } from "@/lib/assets/media-logo-backfill-operation";
import { prisma } from "@/lib/db/prisma";
import { getRuntimeEnvironment } from "@/lib/env";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { getCurrentTenantContextById } from "@/lib/tenants/context";

export function isMediaLogoBackfillAuthEnvironmentAllowed(): boolean {
  return getRuntimeEnvironment().appEnv === "stage";
}

export async function requireMediaLogoBackfillApiAccess() {
  if (!isMediaLogoBackfillAuthEnvironmentAllowed()) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Forbidden",
      session: null,
    };
  }

  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return access;
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Forbidden",
      session: access.session,
    };
  }

  const tenant = await getCurrentTenantContextById(tenantId);
  if (!tenant || tenant.key !== MEDIA_LOGO_BACKFILL_TENANT_KEY) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Forbidden",
      session: access.session,
    };
  }

  return {
    ok: true as const,
    status: 200 as const,
    error: null,
    session: access.session,
    tenant,
  };
}

export async function resolveMediaLogoBackfillTenantId(): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { key: MEDIA_LOGO_BACKFILL_TENANT_KEY, status: "ACTIVE" },
    select: { id: true },
  });

  return tenant?.id ?? null;
}
