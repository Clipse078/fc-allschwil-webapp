import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { getRegistrationForTenant } from "@/lib/registrations/queries";
import { createPersonFromRegistration } from "@/lib/registrations/person-creation";

type Context = {
  params: Promise<{
    tenantSlug: string;
    registrationId: string;
  }>;
};

/**
 * POST /api/tenants/[tenantSlug]/registrations/[registrationId]/create-person
 *
 * REGISTRATION-01F — Goal 3: "Create Person" workflow action.
 *
 * Gated by REGISTRATIONS_EDIT (not PEOPLE_MANAGE): creating a Person here
 * is a Registration-workflow side effect, not general People administration
 * — a coordinator who may already edit registrations must be able to
 * complete this step without a separate People permission grant.
 *
 * Goal 11 (safety): if a possible/confirmed Person match exists, this
 * returns 409 with the match candidates unless the caller sends
 * `{ confirm: true }` — the UI must show the match and require explicit
 * confirmation before retrying.
 */
export async function POST(request: NextRequest, context: Context) {
  const access = await requireApiAnyPermission([PERMISSIONS.REGISTRATIONS_EDIT]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { tenantSlug, registrationId } = await context.params;
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const confirm = body && typeof body === "object" && (body as Record<string, unknown>).confirm === true;

    const actorId = access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

    const result = await createPersonFromRegistration(
      tenantSlug,
      registrationId,
      { confirmDespiteMatch: confirm },
      actorId,
    );

    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
      }
      if (result.reason === "ALREADY_LINKED") {
        return NextResponse.json(
          { error: "Diese Anmeldung ist bereits mit einer Person verknüpft.", personId: result.personId },
          { status: 409 },
        );
      }
      // POSSIBLE_MATCH — Goal 11: never create silently, require confirmation.
      return NextResponse.json(
        {
          error: "Es wurde eine mögliche bestehende Person gefunden. Bitte bestätigen, um trotzdem eine neue Person anzulegen.",
          requiresConfirmation: true,
          candidates: result.candidates,
        },
        { status: 409 },
      );
    }

    const registration = await getRegistrationForTenant(tenantSlug, registrationId);

    revalidatePath(`/tenant/${tenantSlug}/cockpit/registrations`);
    revalidatePath(`/tenant/${tenantSlug}/cockpit/registrations/${registrationId}`);

    return NextResponse.json({
      message: "Person erfolgreich erstellt.",
      personId: result.personId,
      registration,
    });
  } catch (error) {
    console.error("Create person from registration failed:", error);

    if (error instanceof Error && error.message.startsWith("Active tenant not found")) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Person konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
