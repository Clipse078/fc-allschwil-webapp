import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TargetGroupForm from "@/components/admin/org/TargetGroupForm";

export default async function NewTargetGroupPage() {
  await requireAnyPermission([PERMISSIONS.ORG_MANAGE]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Zielgruppen"
        title="Neue Zielgruppe"
        description="Erstelle eine benannte Gruppe für Sichtbarkeit, Kommunikation und Routing."
      />
      <TargetGroupForm mode="create" />
    </div>
  );
}
