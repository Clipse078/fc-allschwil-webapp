import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { logAction } from "@/lib/audit/log-action";
import { TeamNotFoundError, restoreTeam } from "@/lib/teams/team-lifecycle-service";

type Context = { params: Promise<{ teamId: string }> };

/**
 * POST /api/teams/[teamId]/restore
 *
 * Restores a previously archived tenant-owned Team (isActive=true).
 * Strictly tenant-scoped; requires TEAMS_MANAGE.
 */
export async function POST(_request: NextRequest, { params }: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { teamId } = await params;

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  try {
    const team = await restoreTeam(tenant.id, teamId);

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "teams",
      entityType: "Team",
      entityId: team.id,
      action: "RESTORE",
      afterJson: { id: team.id, isActive: team.isActive },
    });

    revalidatePath("/dashboard/teams");
    revalidatePath("/dashboard/teams/" + team.id);

    return NextResponse.json({ message: "Team wurde wiederhergestellt.", team });
  } catch (error) {
    if (error instanceof TeamNotFoundError) {
      return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
    }

    console.error("Restore team failed:", error);
    return NextResponse.json(
      { error: "Team konnte nicht wiederhergestellt werden." },
      { status: 500 }
    );
  }
}
