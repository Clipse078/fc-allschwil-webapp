import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { PageShell } from "@/components/ui/page";
import TeamRegistrationWizard from "@/components/admin/teams/registration/TeamRegistrationWizard";

export default async function TeamRegisterPage() {
  await requirePermission(PERMISSIONS.TEAMS_MANAGE);

  return (
    <PageShell fullWidth>
      <TeamRegistrationWizard />
    </PageShell>
  );
}
