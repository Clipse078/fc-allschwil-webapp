import Link from "next/link";
import TeamCreateForm from "@/components/admin/teams/TeamCreateForm";
import { PageHeader, PageShell } from "@/components/shared/page";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewTeamPage() {
  await requirePermission(PERMISSIONS.TEAMS_MANAGE);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Teams"
        title="Neues Team"
        description="Lege ein neues Team an. Wenn eine aktive Saison vorhanden ist, wird automatisch eine Team-Season-Zuordnung erstellt."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Teams", href: "/dashboard/teams" },
          { label: "Neu" },
        ]}
        actions={
          <Link href="/dashboard/teams" className="fca-button-secondary">
            Zurück zu Teams
          </Link>
        }
      />

      <TeamCreateForm />
    </PageShell>
  );
}
