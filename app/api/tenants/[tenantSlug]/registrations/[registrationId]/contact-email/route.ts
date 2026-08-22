import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import { updateRegistrationContactEmailForTenant } from "@/lib/registrations/contact-email-service";

type Context = {
  params: Promise<{
    tenantSlug: string;
    registrationId: string;
  }>;
};

export async function GET(_: NextRequest, context: Context) {
  const { tenantSlug, registrationId } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, tenantId: tenantResult.tenantId },
    select: { id: true, email: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ email: registration.email });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { tenantSlug, registrationId } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const session = await auth();
  const actorUserId = session?.user?.effectiveUserId ?? session?.user?.id ?? null;

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : null;
    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: "Bitte gib eine gültige E-Mail-Adresse ein." },
        { status: 400 },
      );
    }
    const updated = await updateRegistrationContactEmailForTenant(
      tenantSlug,
      registrationId,
      email,
      actorUserId,
    );
    return NextResponse.json({ email: updated.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "E-Mail-Adresse konnte nicht gespeichert werden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

