import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitType, OrgUnitStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { revalidatePath } from "next/cache";

// Slice 11.2b: tenant resolved from session-carried tenantId via getTenantFromSession().
// Slice 11.5: PUT now handles parentId re-parenting with cycle detection,
// max-depth guard, and cascading level updates.

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns true if the OrgUnit belongs to a different tenant than the resolved one.
 *
 * Null tenantId: legacy rows backfilled in migration
 * 20260601124700_add_org_membership_relations_tenant_backfill should have no
 * null tenantId rows remaining. If one is encountered it is treated as belonging
 * to the resolved (default) tenant — this is the documented backwards-compat
 * fallback to avoid breaking any pre-migration residue.
 */
function isCrossTenant(orgUnitTenantId: string | null, resolvedTenantId: string): boolean {
  if (orgUnitTenantId === null) return false;
  return orgUnitTenantId !== resolvedTenantId;
}

/**
 * Walk up the ancestor chain of `candidateParentId`. Returns true if `unitId`
 * appears in that chain, which would create a cycle.
 */
async function wouldCreateCycle(unitId: string, candidateParentId: string): Promise<boolean> {
  let current: string | null = candidateParentId;
  while (current !== null) {
    if (current === unitId) return true;
    const found: { parentId: string | null } | null = await prisma.orgUnit.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = found?.parentId ?? null;
  }
  return false;
}

/**
 * Returns the maximum depth of the subtree rooted at `unitId` relative to
 * that unit (0 = leaf, 1 = has children, 2 = has grandchildren).
 * Bounded by the max depth 3 invariant so recursion stays shallow.
 */
async function maxSubtreeDepth(unitId: string): Promise<number> {
  const children = await prisma.orgUnit.findMany({
    where: { parentId: unitId },
    select: { id: true },
  });
  if (children.length === 0) return 0;
  const depths = await Promise.all(children.map((c) => maxSubtreeDepth(c.id)));
  return 1 + Math.max(...depths);
}

/**
 * Recursively update the `level` field of all descendants of `parentId`.
 * Called after a unit's level changes due to re-parenting.
 */
async function cascadeLevelUpdate(parentId: string, parentLevel: number): Promise<void> {
  const children = await prisma.orgUnit.findMany({
    where: { parentId },
    select: { id: true },
  });
  for (const child of children) {
    await prisma.orgUnit.update({
      where: { id: child.id },
      data: { level: parentLevel + 1 },
    });
    await cascadeLevelUpdate(child.id, parentLevel + 1);
  }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const orgUnit = await getOrgUnitById(id);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(orgUnit.tenantId, tenant.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ orgUnit });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const existing = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, level: true, tenantId: true, parentId: true },
  });
  if (!existing) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(existing.tenantId, tenant.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const validTypes = Object.values(OrgUnitType);
  const validStatuses = Object.values(OrgUnitStatus);

  // Restore guard: when status changes away from ARCHIVED, clear archivedAt.
  const newStatus: OrgUnitStatus | undefined = validStatuses.includes(body?.status)
    ? body.status
    : undefined;

  // parentId: undefined = body did not include it (no change), null = make root, string = set parent
  const parentIdInBody = body !== null && typeof body === "object" && "parentId" in body;
  const parentIdRaw = parentIdInBody ? body.parentId : undefined;
  const newParentId: string | null | undefined = !parentIdInBody
    ? undefined
    : parentIdRaw === null || parentIdRaw === ""
      ? null
      : String(parentIdRaw).trim() || null;

  let newLevel: number | undefined;

  if (newParentId !== undefined && newParentId !== existing.parentId) {
    if (newParentId === id) {
      return NextResponse.json(
        { error: "Eine Einheit kann nicht ihre eigene übergeordnete Einheit sein." },
        { status: 400 }
      );
    }

    if (newParentId !== null) {
      // Validate new parent: must exist and belong to the same tenant.
      const newParent = await prisma.orgUnit.findUnique({
        where: { id: newParentId },
        select: { id: true, level: true, tenantId: true },
      });
      if (!newParent) {
        return NextResponse.json(
          { error: "Übergeordnete Einheit nicht gefunden." },
          { status: 404 }
        );
      }
      if (isCrossTenant(newParent.tenantId, tenant.id)) {
        return NextResponse.json(
          { error: "Übergeordnete Einheit nicht gefunden." },
          { status: 404 }
        );
      }

      // Cycle detection: new parent must not be a descendant of the unit being updated.
      const cycle = await wouldCreateCycle(id, newParentId);
      if (cycle) {
        return NextResponse.json(
          { error: "Ungültige Überordnung: die gewählte Einheit ist eine Untereinheit dieser Einheit." },
          { status: 400 }
        );
      }

      newLevel = newParent.level + 1;

      // Max depth guard: resulting level must not exceed 2 (0-indexed, so depth 3 total).
      if (newLevel > 2) {
        return NextResponse.json(
          { error: "Maximale Verschachtelungstiefe von 3 Ebenen erreicht." },
          { status: 400 }
        );
      }

      // Subtree depth guard: deepest descendant must also not exceed level 2.
      const subtreeDepth = await maxSubtreeDepth(id);
      if (newLevel + subtreeDepth > 2) {
        return NextResponse.json(
          { error: "Diese Einheit hat Untereinheiten; die gewählte Überordnung würde die maximale Tiefe von 3 Ebenen überschreiten." },
          { status: 400 }
        );
      }
    } else {
      // Becoming a root unit (no parent).
      newLevel = 0;
      const subtreeDepth = await maxSubtreeDepth(id);
      if (subtreeDepth > 2) {
        return NextResponse.json(
          { error: "Diese Einheit hat zu tiefe Untereinheiten, um als Haupteinheit gesetzt zu werden." },
          { status: 400 }
        );
      }
    }
  }

  try {
    const updated = await prisma.orgUnit.update({
      where: { id },
      data: {
        name: body?.name?.trim() || undefined,
        description: body?.description?.trim() || null,
        type: validTypes.includes(body?.type) ? body.type : undefined,
        status: newStatus,
        // Clear archivedAt when restoring from ARCHIVED; set when archiving via status change.
        ...(newStatus !== undefined && newStatus !== "ARCHIVED"
          ? { archivedAt: null }
          : newStatus === "ARCHIVED"
            ? { archivedAt: new Date() }
            : {}),
        sortOrder: body?.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
        ...(newParentId !== undefined ? { parentId: newParentId, level: newLevel } : {}),
      },
      select: { id: true, key: true, name: true, type: true, status: true, level: true, parentId: true, archivedAt: true },
    });

    // Cascade level update to all descendants when the level changed.
    if (newLevel !== undefined && newLevel !== existing.level) {
      await cascadeLevelUpdate(id, newLevel);
    }

    revalidatePath("/dashboard/org-units");
    revalidatePath("/dashboard/org-units/" + id);

    return NextResponse.json({ orgUnit: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Organisationseinheit konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const existing = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, tenantId: true, _count: { select: { children: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(existing.tenantId, tenant.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }
  if (existing._count.children > 0) {
    return NextResponse.json({ error: "Organisationseinheiten mit Untereinheiten können nicht gelöscht werden. Bitte Untereinheiten zuerst entfernen oder archivieren." }, { status: 409 });
  }

  await prisma.orgUnit.update({
    where: { id },
    data: { status: OrgUnitStatus.ARCHIVED, archivedAt: new Date() },
  });
  revalidatePath("/dashboard/org-units");
  return NextResponse.json({ message: "Organisationseinheit wurde archiviert." });
}
