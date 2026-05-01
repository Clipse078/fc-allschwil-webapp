import Link from "next/link";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { PageHeader, PageShell } from "@/components/shared/page";
import NextSeasonPlannerCard from "@/components/admin/seasons/NextSeasonPlannerCard";

export default async function NextSeasonPlannerPage() {
  await requirePermission(PERMISSIONS.SEASONS_MANAGE);

  return (
    <PageShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Saisons"
          title="Next Season Planner"
          description="Erstelle zuerst die nächste künftige Saison. Danach können Teams, Sponsoren und Events sauber saisonspezifisch für diese Zukunftssaison geplant werden."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Saisons", href: "/dashboard/seasons" },
            { label: "Next Season Planner" },
          ]}
          actions={
            <Link href="/dashboard/seasons" className="fca-button-secondary">
              Zurück zu Saisons
            </Link>
          }
        />

      <NextSeasonPlannerCard />
      </div>
    </PageShell>
  );
}
