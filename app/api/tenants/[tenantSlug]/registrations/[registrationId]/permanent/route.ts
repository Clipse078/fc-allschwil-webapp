/**
 * DELETE /api/tenants/[tenantSlug]/registrations/[registrationId]/permanent
 *
 * ADMIN-DELETE-03B — permanent hard delete for a Registration (Anmeldung).
 *
 * Requires PERMISSIONS.REGISTRATIONS_DELETE — deliberately NOT
 * REGISTRATIONS_EDIT, which authorizes status/workflow mutations but must
 * never imply permanent deletion. A dedicated `/permanent` sub-route is used
 * to keep the existing PATCH contract completely unchanged.
 *
 * Authorization model (mirrors workspace/documents/[documentId]/permanent and
 * training-series/[seriesId]/permanent, ADMIN-DELETE-03A / 02A-C1):
 *
 *   1. The target registration (and therefore its owning tenant) is resolved
 *      strictly server-side from `registrationId` — a client-supplied tenantId
 *      is never trusted for this decision.
 *   2. The tenantSlug URL segment provides a second layer of cross-tenant
 *      isolation: the registration's DB-resolved tenantId must belong to the
 *      tenant identified by the slug.
 *   3. EffectivePermissionResolver.hasTenantDeletionAuthority() decides
 *      whether the caller may delete within that exact tenant. Grants access
 *      via either a tenant-scoped registrations.delete grant (Club Admin /
 *      delegated user) or the SCE Super Admin's platform-held grant resolved
 *      against the confirmed-active tenant.
 *
 * Two-step "inspect impact → explicit confirmation → delete" flow:
 *
 *   DELETE .../permanent             → PREVIEW: returns 200 with impact +
 *                                       requiresConfirmation: true. No mutation.
 *   DELETE .../permanent?confirm=true → PERFORM: permanently deletes the
 *                                        registration. Person.createdRegistrationId
 *                                        FK is set to NULL by Prisma cascade.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  deleteRegistrationPermanently,
  getRegistrationDeletionImpact,
} from "@/lib/registrations/registration-delete-service";

type Params = {
  params: Promise<{ tenantSlug: string; registrationId: string }>;
};

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantSlug, registrationId } = await params;

  // Resolve the target registration and its tenant strictly server-side —
  // never trust a client-supplied tenantId for a permanent-deletion decision.
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      tenantId: true,
      tenant: { select: { key: true, status: true } },
      firstName: true,
      lastName: true,
    },
  });

  if (!registration) {
    return NextResponse.json(
      { error: "Anmeldung nicht gefunden." },
      { status: 404 },
    );
  }

  // Cross-tenant guard: the registration's tenant must match the URL slug.
  if (registration.tenant.key !== tenantSlug) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const registrationTenantId = registration.tenantId;

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.REGISTRATIONS_DELETE,
    tenantId: registrationTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getRegistrationDeletionImpact(
      registrationTenantId,
      registrationId,
    );

    if (impact === null) {
      return NextResponse.json(
        { error: "Anmeldung nicht gefunden." },
        { status: 404 },
      );
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteRegistrationPermanently(
    registrationTenantId,
    registrationId,
  );

  if (!result) {
    return NextResponse.json(
      { error: "Anmeldung nicht gefunden." },
      { status: 404 },
    );
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "registrations",
    entityType: "Registration",
    entityId: registrationId,
    action: "DELETE",
    beforeJson: {
      id: registrationId,
      label: result.registrationLabel,
      tenantSlug,
    },
  });

  revalidatePath(`/tenant/${tenantSlug}/cockpit/registrations`);

  return NextResponse.json({
    message: "Anmeldung wurde endgültig gelöscht.",
  });
}
