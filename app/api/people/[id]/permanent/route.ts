/**
 * DELETE /api/people/[id]/permanent — Person permanent hard delete.
 *
 * ADMIN-DELETE-PERSONS-01: Requires PERMISSIONS.PEOPLE_DELETE — deliberately
 * NOT PEOPLE_MANAGE, which authorizes create/edit/archive but must never
 * imply permanent deletion. A dedicated `/permanent` sub-route keeps the
 * existing DELETE /api/people/[id] behavior completely unchanged.
 *
 * Authorization:
 *   1. Person and its owning tenant are resolved server-side from `id`.
 *   2. EffectivePermissionResolver.hasTenantDeletionAuthority() decides
 *      whether the caller may delete within that exact tenant.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns 200 + impact +
 *                                        requiresConfirmation: true. No mutation.
 *   DELETE .../permanent?confirm=true → PERFORM: atomically cleans squad
 *                                        memberships, assignments, then
 *                                        deletes the Person. Global User,
 *                                        TenantMembership, and UserRole are
 *                                        never touched.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getPersonDeletionImpact,
  deletePersonPermanently,
} from "@/lib/people/person-delete-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Resolve Person and its tenant strictly server-side.
  const person = await prisma.person.findUnique({
    where: { id },
    select: { id: true, tenantId: true, firstName: true, lastName: true },
  });

  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const personTenantId = person.tenantId;

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.PEOPLE_DELETE,
    tenantId: personTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getPersonDeletionImpact(personTenantId, id);

    if (impact === null) {
      return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deletePersonPermanently(personTenantId, id);

  if (!result) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "persons",
    entityType: "Person",
    entityId: id,
    action: "DELETE",
    beforeJson: {
      firstName: result.firstName,
      lastName: result.lastName,
      impact: result.impact,
      globalUserPreserved: result.impact.linkedUserId !== null,
    },
  });

  revalidatePath("/dashboard/persons");

  return NextResponse.json({
    message: "Person wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
