import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/require-api-session";
import { getAuthorizedPersonIdsForUser } from "@/lib/participation/authorization";
import { getMyUpcomingParticipationRequests } from "@/lib/participation/queries";

export async function GET() {
  const session = await requireApiSession();

  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const tenantId = session.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant aktiv." }, { status: 400 });
  }

  const actorUserId = session.session.user.id;
  const personIds = await getAuthorizedPersonIdsForUser(tenantId, actorUserId);
  const requests = await getMyUpcomingParticipationRequests(tenantId, personIds);

  return NextResponse.json({ requests });
}
