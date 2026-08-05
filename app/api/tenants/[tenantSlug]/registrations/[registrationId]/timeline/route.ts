import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { getRegistrationTimeline } from "@/lib/registrations/timeline";

type Context = {
  params: Promise<{
    tenantSlug: string;
    registrationId: string;
  }>;
};

/**
 * GET /api/tenants/[tenantSlug]/registrations/[registrationId]/timeline
 *
 * REGISTRATION-01F — Goal 5: simple chronological timeline, newest first.
 */
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
    const timeline = await getRegistrationTimeline(tenantSlug, registrationId);
    return NextResponse.json({ timeline });
  } catch (error) {
    console.error("Get registration timeline failed:", error);

    if (error instanceof Error && error.message.startsWith("Active tenant not found")) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Verlauf konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
