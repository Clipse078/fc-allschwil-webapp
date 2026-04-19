import InitiativenRoadmapClient from "@/components/admin/vereinsleitung/InitiativenRoadmapClient";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

export default async function VereinsleitungInitiativenPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_INITIATIVES_READ);

  return <InitiativenRoadmapClient />;
}
