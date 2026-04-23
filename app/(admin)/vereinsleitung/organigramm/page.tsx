import { auth } from "@/auth";
import VereinsleitungOrganigrammClient from "@/components/admin/vereinsleitung/VereinsleitungOrganigrammClient";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getOrganigrammOverview } from "@/lib/vereinsleitung/organigramm";

export default async function VereinsleitungOrganigrammPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_ORGANIGRAMM_READ);

  const [session, overview] = await Promise.all([
    auth(),
    getOrganigrammOverview(),
  ]);

  const canManage = Boolean(
    session?.user?.permissionKeys?.includes(PERMISSIONS.USERS_MANAGE),
  );

  return <VereinsleitungOrganigrammClient overview={overview} canManage={canManage} />;
}
