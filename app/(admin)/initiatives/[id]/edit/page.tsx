import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getInitiativeById } from "@/lib/initiatives/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import InitiativeEditForm from "@/components/admin/initiatives/InitiativeEditForm";

type EditInitiativePageProps = { params: Promise<{ id: string }> };

export default async function EditInitiativePage({ params }: EditInitiativePageProps) {
  await requirePermission(PERMISSIONS.INITIATIVES_MANAGE);

  const { id } = await params;
  const initiative = await getInitiativeById(id);
  if (!initiative) notFound();

  return (
    <PageShell>
      <SectionCard className="p-6 lg:p-8">
        <InitiativeEditForm
          id={id}
          initialValues={{
            title:         initiative.title,
            summary:       initiative.summary,
            description:   initiative.description,
            status:        initiative.status,
            priority:      initiative.priority,
            orgUnitLabel:  initiative.orgUnitLabel,
            ownerName:     initiative.ownerName,
            dueDate:       initiative.dueDate,
            startsAt:      initiative.startsAt,
            completedAt:   initiative.completedAt,
          }}
        />
      </SectionCard>
    </PageShell>
  );
}
