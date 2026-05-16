import Link from "next/link";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NextSeasonPlannerCard from "@/components/admin/seasons/NextSeasonPlannerCard";

export default async function NextSeasonPlannerPage() {
  await requirePermission(PERMISSIONS.SEASONS_MANAGE);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Saisons"
        title="Next Season Planner"
        description="Erstelle zuerst die nächste künftige Saison. Danach können Teams, Sponsoren und Events sauber saisonspezifisch für diese Zukunftssaison geplant werden."
        actions={
          <Link href="/dashboard/seasons" className="fca-button-secondary">
            Zurück zu Saisons
          </Link>
        }
      />

      <NextSeasonPlannerCard />
    </div>
  );
}
