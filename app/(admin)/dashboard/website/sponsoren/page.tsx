import Link from "next/link";
import { Handshake } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import SponsorsTable from "@/components/admin/sponsors/SponsorsTable";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";
import { getSponsorListData } from "@/lib/website/sponsor-queries";

type SponsorsListPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "warning" | "error" }> = {
  created: { text: "Sponsor erfolgreich erstellt.", tone: "success" },
  deleted: { text: "Sponsor wurde gelöscht.", tone: "success" },
  "no-site": {
    text: "Kein aktiver Website-Eintrag gefunden.",
    tone: "warning",
  },
};

export default async function SponsorsListPage({ searchParams }: SponsorsListPageProps) {
  await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const params = (await searchParams) ?? {};
  const statusEntry = params.status ? (STATUS_MESSAGES[params.status] ?? null) : null;

  const site = await getDefaultSite();
  const sponsors = site ? await getSponsorListData(site.id) : [];

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · Sponsoren"
        title="Sponsoren"
        description="Verwalte Vereinspartner und steuere deren Sichtbarkeit auf Website, Infoboard und Sponsor-Strip."
        actions={
          site ? (
            <Link
              href="/dashboard/website/sponsoren/new"
              className="fca-button-primary"
            >
              Neuer Sponsor
            </Link>
          ) : null
        }
      />

      <AdminSurfaceCard className="border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-start gap-3">
          <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              Klare Sponsor-Präsentation stärkt die Vereinspartnerschaften.
            </p>
            <p className="text-sm text-slate-600">
              Die Sichtbarkeit kann pro Sponsor individuell für Website, Infoboard und Sponsor-Strip gesteuert werden.
            </p>
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

      {!site && (
        <AdminSurfaceCard className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            Kein aktiver Website-Eintrag gefunden. Eine{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">WebsiteSite</code>
            {" "}mit{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">isActive = true</code>
            {" "}wird benötigt.
          </p>
        </AdminSurfaceCard>
      )}

      <SponsorsTable sponsors={sponsors} />
    </div>
  );
}
