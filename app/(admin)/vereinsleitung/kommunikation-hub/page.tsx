import AdminModulePlaceholder from "@/components/admin/shared/AdminModulePlaceholder";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

export default async function Page() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_READ);

  return (
    <AdminModulePlaceholder
      eyebrow="1. Vereinsleitung"
      title="Kommunikation HUB"
      description="Demo-Placeholder für den zukünftigen Kommunikations-Hub der Vereinsleitung."
    />
  );
}