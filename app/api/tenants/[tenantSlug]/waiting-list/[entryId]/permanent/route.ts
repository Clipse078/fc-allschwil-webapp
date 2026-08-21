/**
 * DELETE /api/tenants/[tenantSlug]/waiting-list/[entryId]/permanent
 *
 * REG-WAIT-01: Permanent hard-delete for a single WaitingListEntry.
 *
 * Requires REGISTRATIONS_DELETE — deliberately NOT REGISTRATIONS_EDIT.
 * Two-step flow: preview (no confirm param) → explicit confirm=true.
 *
 * Deleting a WaitingListEntry does NOT:
 *   - delete the Registration
 *   - delete the Person
 *   - delete any TeamSeason or squad record
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  deleteWaitingListEntryPermanently,
  getWaitingListDeletionImpact,
} from "@/lib/registrations/waiting-list-service";

type Context = { params: Promise<{ tenantSlug: string; entryId: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantSlug, entryId } = await params;

  // Resolve entry and owning tenant strictly server-side.
  const entry = await prisma.waitingListEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      tenantId: true,
      tenant: { select: { key: true, status: true } },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Wartelisten-Eintrag nicht gefunden." }, { status: 404 });
  }

  // Cross-tenant guard: the entry's tenant must match the URL slug.
  if (entry.tenant.key !== tenantSlug) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.REGISTRATIONS_DELETE,
    tenantId: entry.tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getWaitingListDeletionImpact(entry.tenantId, entryId);
    if (!impact) {
      return NextResponse.json({ error: "Wartelisten-Eintrag nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteWaitingListEntryPermanently(entry.tenantId, entryId);
  if (!result) {
    return NextResponse.json({ error: "Wartelisten-Eintrag nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "registrations",
    entityType: "WaitingListEntry",
    entityId: entryId,
    action: "DELETE",
    beforeJson: { id: entryId, label: result.label, tenantSlug },
  });

  return NextResponse.json({ message: "Wartelisten-Eintrag wurde endgültig gelöscht." });
}
