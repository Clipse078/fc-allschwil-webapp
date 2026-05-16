import Link from "next/link";
import TeamCreateForm from "@/components/admin/teams/TeamCreateForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewTeamPage() {
  await requirePermission(PERMISSIONS.TEAMS_MANAGE);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Teams"
        title="Neues Team"
        description="Lege ein neues Team an. Wenn eine aktive Saison vorhanden ist, wird automatisch eine Team-Season-Zuordnung erstellt."
        actions={
          <Link href="/dashboard/teams" className="fca-button-secondary">
            Zurück zu Teams
          </Link>
        }
      />

      <TeamCreateForm />
    </div>
  );
}
