import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { RegistrationStatus } from "@prisma/client";
import { logAction } from "@/lib/audit/log-action";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import {
  getRegistrationForTenant,
  updateRegistrationStatusForTenant,
} from "@/lib/registrations/queries";

type Context = {
  params: Promise<{
    tenantSlug: string;
    registrationId: string;
  }>;
};

// REGISTRATION-01F — Goal 1/12: explicit workflow-action tags. These are
// purely an audit/timeline label — they never change what fields the PATCH
// itself may write. Sent alongside the actual field changes so an action
// like "No recommendation" (which may leave every field unchanged) still
// produces a visible, attributable timeline/audit entry (Goal 5/12).
const WORKFLOW_ACTIONS = new Set([
  "ASSIGN_RECOMMENDED_TEAM",
  "ASSIGN_ELSEWHERE",
  "NO_RECOMMENDATION",
]);

function actorUserId(session: Awaited<ReturnType<typeof requireApiAnyPermission>>["session"]) {
  return session?.user?.effectiveUserId ?? session?.user?.id ?? null;
}

function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return typeof value === "string" && Object.values(RegistrationStatus).includes(value as RegistrationStatus);
}

export async function GET(_: NextRequest, context: Context) {
  const { tenantSlug, registrationId } = await context.params;

  // RPERM-04-C1: resolve + validate the tenant named in the URL FIRST — never
  // authorize this route against session.user.activeTenantId. Rejects before
  // any registration data is fetched if the tenant does not exist, is not
  // ACTIVE, or the caller has no active membership in it.
  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  // Permission is evaluated against the EXACT tenant resolved from the URL.
  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const registration = await getRegistrationForTenant(tenantSlug, registrationId);

    if (!registration) {
      return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ registration });
  } catch (error) {
    console.error("Get registration failed:", error);

    if (error instanceof Error && error.message.startsWith("Active tenant not found")) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Anmeldung konnte nicht geladen werden." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const { tenantSlug, registrationId } = await context.params;

  // RPERM-04-C1: resolve + validate the tenant named in the URL FIRST — never
  // authorize this route against session.user.activeTenantId. Rejects before
  // any registration data is fetched/mutated if the tenant does not exist,
  // is not ACTIVE, or the caller has no active membership in it.
  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  // Permission is evaluated against the EXACT tenant resolved from the URL.
  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();

    const data: {
      status?: RegistrationStatus;
      assignedToUserId?: string | null;
      targetGroupId?: string | null;
      personId?: string | null;
      duplicateIgnored?: boolean;
    } = {};

    if ("status" in body) {
      if (!isRegistrationStatus(body.status)) {
        return NextResponse.json({ error: "Ungueltiger Status." }, { status: 400 });
      }
      data.status = body.status;
    }

    if ("assignedToUserId" in body) {
      const val = body.assignedToUserId;
      if (val !== null && typeof val !== "string") {
        return NextResponse.json(
          { error: "assignedToUserId muss ein String oder null sein." },
          { status: 400 }
        );
      }
      data.assignedToUserId = val;
    }

    if ("targetGroupId" in body) {
      const val = body.targetGroupId;
      if (val !== null && typeof val !== "string") {
        return NextResponse.json(
          { error: "targetGroupId muss ein String oder null sein." },
          { status: 400 }
        );
      }
      data.targetGroupId = val;
    }

    // REGISTRATION-01F — Goal 2/3: link/unlink an existing (or newly
    // created) Person. Never invents a Person — see person-creation.ts for
    // the only path that creates one.
    if ("personId" in body) {
      const val = body.personId;
      if (val !== null && typeof val !== "string") {
        return NextResponse.json(
          { error: "personId muss ein String oder null sein." },
          { status: 400 }
        );
      }
      data.personId = val;
    }

    // REGISTRATION-01F — Goal 7: "Ignore duplicate" workflow action.
    if ("duplicateIgnored" in body) {
      if (body.duplicateIgnored !== true) {
        return NextResponse.json(
          { error: "duplicateIgnored unterstuetzt nur den Wert true." },
          { status: 400 }
        );
      }
      data.duplicateIgnored = true;
    }

    const workflowAction =
      typeof body.workflowAction === "string" && WORKFLOW_ACTIONS.has(body.workflowAction)
        ? (body.workflowAction as string)
        : null;

    if (Object.keys(data).length === 0 && !workflowAction) {
      return NextResponse.json(
        { error: "Keine unterstuetzte Aenderung uebergeben." },
        { status: 400 }
      );
    }

    const actorId = actorUserId(access.session);

    const result = await updateRegistrationStatusForTenant(
      tenantSlug,
      registrationId,
      data,
      actorId,
    );

    if (!result) {
      return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
    }

    const { before, registration } = result;

    if (before.status !== registration.status) {
      void logAction({
        actorUserId: actorId,
        moduleKey: "registrations",
        entityType: "Registration",
        entityId: registration.id,
        action: "STATUS_CHANGE",
        beforeJson: { status: before.status },
        afterJson: { status: registration.status },
        metadataJson: { tenantSlug },
      });
    }

    if (before.assignedToUserId !== registration.assignedToUserId) {
      void logAction({
        actorUserId: actorId,
        moduleKey: "registrations",
        entityType: "Registration",
        entityId: registration.id,
        action: "ASSIGNMENT_CHANGE",
        beforeJson: { assignedToUserId: before.assignedToUserId },
        afterJson: { assignedToUserId: registration.assignedToUserId },
        metadataJson: { tenantSlug },
      });
    }

    if (before.targetGroupId !== registration.targetGroupId) {
      void logAction({
        actorUserId: actorId,
        moduleKey: "registrations",
        entityType: "Registration",
        entityId: registration.id,
        action: workflowAction ?? "TARGET_GROUP_CHANGE",
        beforeJson: { targetGroupId: before.targetGroupId },
        afterJson: { targetGroupId: registration.targetGroupId, targetGroupName: registration.targetGroup?.name ?? null },
        metadataJson: { tenantSlug },
      });
    } else if (workflowAction === "NO_RECOMMENDATION") {
      // No field necessarily changed (target group was already empty) —
      // still record the explicit decision (Goal 1/12).
      void logAction({
        actorUserId: actorId,
        moduleKey: "registrations",
        entityType: "Registration",
        entityId: registration.id,
        action: "NO_RECOMMENDATION",
        afterJson: { targetGroupId: registration.targetGroupId },
        metadataJson: { tenantSlug },
      });
    }

    if (before.personId !== registration.personId) {
      void logAction({
        actorUserId: actorId,
        moduleKey: "registrations",
        entityType: "Registration",
        entityId: registration.id,
        action: registration.personId ? "PERSON_LINKED" : "PERSON_UNLINKED",
        beforeJson: { personId: before.personId },
        afterJson: { personId: registration.personId },
        metadataJson: { tenantSlug },
      });
    }

    if (!before.duplicateIgnoredAt && registration.duplicateIgnoredAt) {
      void logAction({
        actorUserId: actorId,
        moduleKey: "registrations",
        entityType: "Registration",
        entityId: registration.id,
        action: "DUPLICATE_IGNORED",
        afterJson: { duplicateIgnoredAt: registration.duplicateIgnoredAt, duplicateIgnoredById: actorId },
        metadataJson: { tenantSlug },
      });
    }

    revalidatePath(`/tenant/${tenantSlug}/cockpit/registrations`);
    revalidatePath(`/tenant/${tenantSlug}/cockpit/registrations/${registration.id}`);

    return NextResponse.json({
      message: "Anmeldung erfolgreich aktualisiert.",
      registration,
    });
  } catch (error) {
    console.error("Update registration failed:", error);

    if (error instanceof Error && error.message.startsWith("Active tenant not found")) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    // Surface tenant-isolation validation errors as 400 (client fault, not server fault).
    if (
      error instanceof Error &&
      (error.message.includes("belongs to a different tenant") ||
        error.message.includes("not found"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Anmeldung konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}
