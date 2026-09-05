import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import {
  applyTenantLifecycleTransition,
  TenantLifecycleError,
} from "@/lib/tenants/platform-ops/lifecycle";
import type { TenantLifecycleAction } from "@/lib/tenants/platform-ops/types";

type RouteContext = { params: Promise<{ tenantSlug: string }> };

const VALID_ACTIONS = new Set<TenantLifecycleAction>([
  "activate",
  "suspend",
  "reactivate",
  "archive",
]);

export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await requirePlatformApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { tenantSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantSlug },
    select: { id: true, key: true, name: true, status: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action as TenantLifecycleAction;
  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Ungültige Lifecycle-Aktion." }, { status: 400 });
  }

  try {
    const result = await applyTenantLifecycleTransition(prisma, tenant, action, {
      actorUserId: access.actorUserId!,
      reason: body?.reason,
    });

    return NextResponse.json({
      tenant: result.tenant,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      action: result.action,
    });
  } catch (error) {
    if (error instanceof TenantLifecycleError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Lifecycle-Aktion konnte nicht ausgeführt werden." },
      { status: 500 },
    );
  }
}
