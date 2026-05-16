import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainersList from "@/components/admin/trainers/TrainersList";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function TrainersPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const trainers: {
    id: string;
    name: string;
    teamLabel?: string | null;
    functionLabel?: string | null;
    imageSrc?: string | null;
    isActive?: boolean;
  }[] = [];

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Trainer"
        title="Trainer"
        description="Premium Trainerübersicht mit persönlicher Bildsprache, Rollenhinweisen und sauberer FCA Kartenlogik."
      />

      <TrainersList trainers={trainers} />
    </div>
  );
}
