import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTargetById } from "@/lib/targets/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import TargetEditForm from "@/components/admin/targets/TargetEditForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditTargetPage({ params }: Props) {
  await requirePermission(PERMISSIONS.TARGETS_MANAGE);
  const { id } = await params;
  const target = await getTargetById(id);
  if (!target) notFound();

  return (
    <PageShell>
      <SectionCard className="p-6 lg:p-8">
        <TargetEditForm
          id={id}
          initialValues={{
            title:          target.title,
            description:    target.description,
            status:         target.status,
            periodType:     target.periodType ?? null,
            startsAt:       target.startsAt,
            endsAt:         target.endsAt,
            orgUnitLabel:   target.orgUnitLabel,
            moduleKey:      target.moduleKey,
            targetCategory: target.targetCategory,
            sportCategory:  target.sportCategory,
            ageGroupHint:   target.ageGroupHint,
          }}
        />
      </SectionCard>
    </PageShell>
  );
}
