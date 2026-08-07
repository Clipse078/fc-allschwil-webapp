import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { PageShell } from "@/components/ui/page";
import { ToastProvider } from "@/components/ui/ToastProvider";
import TeamRegistrationWizard from "@/components/admin/teams/registration/TeamRegistrationWizard";

export default async function TeamRegisterPage() {
  await requirePermission(PERMISSIONS.TEAMS_MANAGE);

  // Pre-existing bug fix (unrelated to TEAM-IDENTITY-01, discovered while
  // manually verifying this page): TeamRegistrationWizard calls useToast()
  // on submit, but no ancestor ever rendered <ToastProvider>, so submitting
  // the wizard always threw "useToast must be used inside <ToastProvider>".
  return (
    <ToastProvider>
      <PageShell fullWidth>
        <TeamRegistrationWizard />
      </PageShell>
    </ToastProvider>
  );
}
