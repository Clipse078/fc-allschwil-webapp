import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { listRegistrationsForTenant } from "@/lib/registrations/queries";

type Context = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

export async function GET(_: NextRequest, context: Context) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.REGISTRATIONS_VIEW,
    PERMISSIONS.REGISTRATIONS_EDIT,
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { tenantSlug } = await context.params;
    const registrations = await listRegistrationsForTenant(tenantSlug);

    return NextResponse.json({ registrations });
  } catch (error) {
    console.error("List registrations failed:", error);

    if (error instanceof Error && error.message.startsWith("Active tenant not found")) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Anmeldungen konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}
