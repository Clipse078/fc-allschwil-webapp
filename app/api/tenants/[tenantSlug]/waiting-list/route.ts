/**
 * GET  /api/tenants/[tenantSlug]/waiting-list
 * POST /api/tenants/[tenantSlug]/waiting-list
 *
 * REG-WAIT-01: Tenant-scoped Waiting List API.
 *
 * GET  — lists WaitingListEntries for the tenant (with optional filters).
 * POST — creates a new WaitingListEntry (transitions Registration to WAITING).
 *
 * Authorization: REGISTRATIONS_VIEW (read) / REGISTRATIONS_EDIT (write).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { listWaitingListEntriesForTenant } from "@/lib/registrations/waiting-list-queries";
import { createWaitingListEntry } from "@/lib/registrations/waiting-list-service";
import type { WaitingListScopeType, WaitingListPriority } from "@prisma/client";

type Context = { params: Promise<{ tenantSlug: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { searchParams } = new URL(request.url);

    const rawStatus = searchParams.get("status");
    const statusFilter = rawStatus ? (rawStatus.split(",") as WaitingListPriority[]) : undefined;

    const entries = await listWaitingListEntriesForTenant(tenantSlug, {
      status: statusFilter as never,
      priority: (searchParams.get("priority") as WaitingListPriority) || undefined,
      scopeType: (searchParams.get("scopeType") as WaitingListScopeType) || undefined,
      targetGroupId: searchParams.get("targetGroupId") || undefined,
      orgUnitId: searchParams.get("orgUnitId") || undefined,
      teamSeasonId: searchParams.get("teamSeasonId") || undefined,
      responsibleUserId: searchParams.get("responsibleUserId") || undefined,
      search: searchParams.get("search") || undefined,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("List waiting list failed:", error);
    return NextResponse.json({ error: "Warteliste konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission([PERMISSIONS.REGISTRATIONS_EDIT], tenantResult.tenantId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const session = await auth();
  const actorUserId = session?.user?.effectiveUserId ?? session?.user?.id ?? null;

  try {
    const body = await request.json();

    const {
      registrationId,
      scopeType,
      targetGroupId,
      orgUnitId,
      teamSeasonId,
      priority,
      responsibleUserId,
      reason,
      internalNote,
    } = body as {
      registrationId: string;
      scopeType: WaitingListScopeType;
      targetGroupId?: string | null;
      orgUnitId?: string | null;
      teamSeasonId?: string | null;
      priority?: WaitingListPriority;
      responsibleUserId?: string | null;
      reason?: string | null;
      internalNote?: string | null;
    };

    if (!registrationId || !scopeType) {
      return NextResponse.json({ error: "registrationId und scopeType sind erforderlich." }, { status: 400 });
    }

    const entry = await createWaitingListEntry(
      tenantSlug,
      { registrationId, scopeType, targetGroupId, orgUnitId, teamSeasonId, priority, responsibleUserId, reason, internalNote },
      actorUserId,
    );

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wartelisten-Eintrag konnte nicht erstellt werden.";
    console.error("Create waiting list entry failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
