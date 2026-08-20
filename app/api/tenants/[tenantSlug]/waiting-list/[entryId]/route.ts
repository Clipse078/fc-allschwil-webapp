/**
 * GET   /api/tenants/[tenantSlug]/waiting-list/[entryId]
 * PATCH /api/tenants/[tenantSlug]/waiting-list/[entryId]
 *
 * REG-WAIT-01: Single WaitingListEntry operations.
 *
 * GET  — fetch one entry (full read-model).
 * PATCH — update priority, responsible user, reason, note, or status.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { getWaitingListEntryForTenant } from "@/lib/registrations/waiting-list-queries";
import { updateWaitingListEntry } from "@/lib/registrations/waiting-list-service";
import type { WaitingListStatus, WaitingListPriority } from "@prisma/client";

type Context = { params: Promise<{ tenantSlug: string; entryId: string }> };

export async function GET(_: NextRequest, context: Context) {
  const { tenantSlug, entryId } = await context.params;

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

  const entry = await getWaitingListEntryForTenant(tenantSlug, entryId);
  if (!entry) {
    return NextResponse.json({ error: "Wartelisten-Eintrag nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { tenantSlug, entryId } = await context.params;

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
    const { priority, responsibleUserId, reason, internalNote, status } = body as {
      priority?: WaitingListPriority;
      responsibleUserId?: string | null;
      reason?: string | null;
      internalNote?: string | null;
      status?: WaitingListStatus;
    };

    const entry = await updateWaitingListEntry(
      tenantSlug,
      entryId,
      { priority, responsibleUserId, reason, internalNote, status },
      actorUserId,
    );

    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Änderung konnte nicht gespeichert werden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
