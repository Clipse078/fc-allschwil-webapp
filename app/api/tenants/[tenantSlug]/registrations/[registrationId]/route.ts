import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { RegistrationStatus } from "@prisma/client";
import { logAction } from "@/lib/audit/log-action";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
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

function actorUserId(session: Awaited<ReturnType<typeof requireApiAnyPermission>>["session"]) {
  return session?.user?.effectiveUserId ?? session?.user?.id ?? null;
}

function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return typeof value === "string" && Object.values(RegistrationStatus).includes(value as RegistrationStatus);
}

export async function GET(_: NextRequest, context: Context) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.REGISTRATIONS_VIEW,
    PERMISSIONS.REGISTRATIONS_EDIT,
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { tenantSlug, registrationId } = await context.params;
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
  const access = await requireApiAnyPermission([PERMISSIONS.REGISTRATIONS_EDIT]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { tenantSlug, registrationId } = await context.params;
    const body = await request.json();

    const data: {
      status?: RegistrationStatus;
      assignedToUserId?: string | null;
      targetGroupId?: string | null;
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

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Keine unterstuetzte Aenderung uebergeben." },
        { status: 400 }
      );
    }

    const result = await updateRegistrationStatusForTenant(
      tenantSlug,
      registrationId,
      data
    );

    if (!result) {
      return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
    }

    const { before, registration } = result;
    const actorId = actorUserId(access.session);

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
        action: "TARGET_GROUP_CHANGE",
        beforeJson: { targetGroupId: before.targetGroupId },
        afterJson: { targetGroupId: registration.targetGroupId },
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

    return NextResponse.json(
      { error: "Anmeldung konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}
