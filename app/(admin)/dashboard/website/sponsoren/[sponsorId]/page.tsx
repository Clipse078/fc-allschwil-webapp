import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import SponsorFormCard from "@/components/admin/sponsors/SponsorFormCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";
import { getSponsorDetailData } from "@/lib/website/sponsor-queries";
import { updateSponsorAction, deleteSponsorAction } from "../actions";

type SponsorDetailPageProps = {
  params: Promise<{ sponsorId: string }>;
  searchParams?: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "warning" | "error" }> = {
  created: { text: "Sponsor erfolgreich erstellt.", tone: "success" },
  saved: { text: "Änderungen gespeichert.", tone: "success" },
  "missing-fields": { text: "Name ist ein Pflichtfeld.", tone: "error" },
};

export default async function SponsorDetailPage({
  params,
  searchParams,
}: SponsorDetailPageProps) {
  await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const { sponsorId } = await params;
  const { status } = (await searchParams) ?? {};
  const statusEntry = status ? (STATUS_MESSAGES[status] ?? null) : null;

  const site = await getDefaultSite();
  if (!site) notFound();

  const sponsor = await getSponsorDetailData(sponsorId, site.id);
  if (!sponsor) notFound();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · Sponsoren"
        title={sponsor.name}
        description={sponsor.tier ?? "Vereinspartner"}
        actions={
          <Link href="/dashboard/website/sponsoren" className="fca-button-secondary">
            Zurück
          </Link>
        }
      />

      <AdminSurfaceCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <AdminStatusPill
              label={sponsor.isActive ? "Aktiv" : "Inaktiv"}
              tone={sponsor.isActive ? "success" : "muted"}
            />
            {sponsor.showOnWebsite && <span className="fca-pill">Website</span>}
            {sponsor.showOnInfoboard && <span className="fca-pill">Infoboard</span>}
            {sponsor.showOnSponsorStrip && <span className="fca-pill">Strip</span>}
          </div>

          <div className="flex items-center gap-3">
            {sponsor.websiteUrl && (
              <a
                href={sponsor.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="fca-button-secondary"
              >
                Website →
              </a>
            )}
            <form action={deleteSponsorAction}>
              <input type="hidden" name="sponsorId" value={sponsor.id} />
              <button
                type="submit"
                className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                Löschen
              </button>
            </form>
          </div>
        </div>
      </AdminSurfaceCard>

      {statusEntry && (
        <AdminSurfaceCard
          className={
            statusEntry.tone === "success"
              ? "border-green-200 bg-green-50 p-4"
              : statusEntry.tone === "error"
                ? "border-red-200 bg-red-50 p-4"
                : "border-amber-200 bg-amber-50 p-4"
          }
        >
          <p
            className={`text-sm font-medium ${
              statusEntry.tone === "success"
                ? "text-green-800"
                : statusEntry.tone === "error"
                  ? "text-red-800"
                  : "text-amber-800"
            }`}
          >
            {statusEntry.text}
          </p>
        </AdminSurfaceCard>
      )}

      <SponsorFormCard
        mode="edit"
        action={updateSponsorAction}
        sponsor={sponsor}
      />
    </div>
  );
}
