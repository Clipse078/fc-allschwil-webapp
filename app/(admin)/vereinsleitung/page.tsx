import VereinsleitungDashboard from "@/components/admin/vereinsleitung/VereinsleitungDashboard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

export default async function Page() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_READ);

  return <VereinsleitungDashboard />;
}
