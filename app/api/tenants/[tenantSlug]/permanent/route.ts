/**
 * DELETE /api/tenants/[tenantSlug]/permanent — Tenant permanent hard delete.
 *
 * ADMIN-DELETE-TENANT-01: Requires PERMISSIONS.TENANTS_DELETE (scope=PLATFORM).
 * This permission is held ONLY by the SCE Super Admin platform role.
 * Tenant-local Club Admins do NOT hold this permission and cannot delete
 * an entire Tenant — this is a deliberate product-level safeguard.
 *
 * This is the highest-impact delete operation in the platform. It removes all
 * tenant-owned data including Persons, Teams, OrgUnits, Events, Trainings,
 * Facilities, Registrations, Media, Workspace content, and Infoboards.
 *
 * Preservation (critical):
 *   - Global User records are NEVER deleted.
 *   - TenantMembership rows cascade-delete with the Tenant (auto).
 *   - UserRole rows scoped to this tenant are explicitly deleted before
 *     the Tenant row to avoid orphaned role assignments (UserRole.tenantId
 *     has onDelete: SetNull from Tenant, meaning rows survive if not cleaned).
 *   - Users who belonged only to this tenant retain their global User record
 *     but lose all tenant-scoped access. Users in other tenants are unaffected.
 *
 * Two-step flow:
 *   DELETE .../permanent              → PREVIEW: impact counts + requiresConfirmation.
 *   DELETE .../permanent?confirm=true → PERFORM: full tenant-local cascade delete.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getTenantDeletionImpact,
  deleteTenantPermanently,
} from "@/lib/tenants/tenant-delete-service";

type Params = { params: Promise<{ tenantSlug: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantSlug } = await params;

  // Resolve the Tenant server-side from the slug.
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantSlug },
    select: { id: true, key: true, name: true, status: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  // TENANTS_DELETE is a PLATFORM-scoped permission. Only the SCE Super Admin
  // platform role carries it. We use hasTenantDeletionAuthority() targeting
  // the tenant's own ID — this method resolves platform-role permission keys
  // separately from tenant-scoped grants (Path 2 in the resolver).
  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.TENANTS_DELETE,
    tenantId: tenant.id,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getTenantDeletionImpact(tenant.id);

    if (impact === null) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteTenantPermanently(tenant.id);

  if (!result) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  // Audit log: written before data is gone (actor still authenticated).
  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "tenants",
    entityType: "Tenant",
    entityId: tenant.id,
    action: "DELETE",
    beforeJson: {
      name: result.name,
      key: result.key,
      impact: result.impact,
      globalUsersPreserved: true,
    },
  });

  return NextResponse.json({
    message: `Tenant „${result.name}" wurde endgültig gelöscht.`,
    impact: result.impact,
  });
}
