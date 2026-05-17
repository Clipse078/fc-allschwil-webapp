import { NextRequest, NextResponse } from "next/server";
import { auth, unstable_update } from "@/auth";
import { canUserSwitchToTenant, getTenantById } from "@/lib/tenants/queries";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const tenantId =
    body !== null &&
    typeof body === "object" &&
    "tenantId" in body &&
    typeof (body as Record<string, unknown>).tenantId === "string"
      ? ((body as Record<string, string>).tenantId as string).trim()
      : "";

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const userId = session.user.effectiveUserId ?? session.user.id;
  const roleKeys = session.user.roleKeys ?? [];

  const allowed = await canUserSwitchToTenant(userId, tenantId, roleKeys);

  if (!allowed) {
    return NextResponse.json(
      { error: "Tenant nicht gefunden oder Zugriff verweigert." },
      { status: 403 },
    );
  }

  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant nicht gefunden oder inaktiv." },
      { status: 404 },
    );
  }

  await unstable_update({
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      roleKeys: session.user.roleKeys,
      permissionKeys: session.user.permissionKeys,
      isImpersonating: session.user.isImpersonating,
      actorUserId: session.user.actorUserId,
      actorEmail: session.user.actorEmail,
      actorName: session.user.actorName,
      effectiveUserId: session.user.effectiveUserId,
      activeTenantId: tenant.id,
      activeTenantSlug: tenant.slug,
      activeTenantName: tenant.displayName ?? tenant.name,
    },
  });

  return NextResponse.json({
    ok: true,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.displayName ?? tenant.name,
    },
  });
}
