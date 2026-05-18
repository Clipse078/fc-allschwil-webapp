import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getMeetingById } from "@/lib/meetings/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import MeetingEditForm from "@/components/admin/meetings/MeetingEditForm";

type EditMeetingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditMeetingPage({ params }: EditMeetingPageProps) {
  await requirePermission(PERMISSIONS.MEETINGS_MANAGE);

  const { id } = await params;
  const meeting = await getMeetingById(id);

  if (!meeting) {
    notFound();
  }

  return (
    <PageShell>
      <SectionCard className="p-6 lg:p-8">
        <MeetingEditForm
          id={id}
          initialValues={{
            title: meeting.title,
            status: meeting.status,
            scheduledAt: meeting.scheduledAt,
            location: meeting.location,
            orgUnitLabel: meeting.orgUnitLabel,
            onlineMeetingUrl: meeting.onlineMeetingUrl,
            description: meeting.description,
            minutesBody: meeting.minutesBody,
          }}
        />
      </SectionCard>
    </PageShell>
  );
}
