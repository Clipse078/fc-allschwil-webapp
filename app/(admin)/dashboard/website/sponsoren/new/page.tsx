import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import SponsorFormCard from "@/components/admin/sponsors/SponsorFormCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";
import { createSponsorAction } from "../actions";

type NewSponsorPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  "missing-fields": "Name ist ein Pflichtfeld.",
};

export default async function NewSponsorPage({ searchParams }: NewSponsorPageProps) {
  await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const params = (await searchParams) ?? {};
  const errorMsg = params.status ? (STATUS_MESSAGES[params.status] ?? null) : null;
  const site = await getDefaultSite();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · Sponsoren"
        title="Neuer Sponsor"
        description="Erfasse einen neuen Vereinspartner und steuere wo er erscheinen soll."
        actions={
          <Link href="/dashboard/website/sponsoren" className="fca-button-secondary">
            Zurück
          </Link>
        }
      />

      {errorMsg && (
        <AdminSurfaceCard className="border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{errorMsg}</p>
        </AdminSurfaceCard>
      )}

      {site ? (
        <SponsorFormCard mode="create" action={createSponsorAction} />
      ) : (
        <AdminSurfaceCard className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">Kein aktiver Website-Eintrag gefunden.</p>
        </AdminSurfaceCard>
      )}
    </div>
  );
}
