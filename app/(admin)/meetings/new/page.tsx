import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import MeetingCreateForm from "@/components/admin/meetings/MeetingCreateForm";

export default async function NewMeetingPage() {
  await requirePermission(PERMISSIONS.MEETINGS_MANAGE);

  return (
    <PageShell>
      <SectionCard className="p-6 lg:p-8">
        <MeetingCreateForm />
      </SectionCard>
    </PageShell>
  );
}
