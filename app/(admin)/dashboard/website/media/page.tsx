import Link from "next/link";
import { ImageIcon, Zap } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import MediaGrid from "@/components/admin/media/MediaGrid";
import AddMediaForm from "@/components/admin/media/AddMediaForm";
import MediaTypeFilter from "@/components/admin/media/MediaTypeFilter";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";
import { getMediaAssetList } from "@/lib/website/media-queries";

type MediaPageProps = {
  searchParams?: Promise<{ status?: string; type?: string }>;
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "warning" | "error" }> = {
  added: { text: "Asset erfolgreich hinzugefügt.", tone: "success" },
  deleted: { text: "Asset wurde gelöscht.", tone: "success" },
  "no-site": { text: "Kein aktiver Website-Eintrag gefunden.", tone: "warning" },
  "missing-url": { text: "URL ist erforderlich.", tone: "error" },
};

export default async function MediaPage({ searchParams }: MediaPageProps) {
  await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const params = (await searchParams) ?? {};
  const statusEntry = params.status ? (STATUS_MESSAGES[params.status] ?? null) : null;
  const typeFilter = params.type ?? "ALL";

  const site = await getDefaultSite();
  const assets = site ? await getMediaAssetList(site.id) : [];

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · Medien"
        title="Mediathek"
        description="Verwalte Bilder, Videos und Dokumente für die Website. URL-basiertes Hinzufügen — Upload-Funktion folgt."
      />

      <AdminSurfaceCard className="border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-start gap-3">
          <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              Konsistente Bilder verbessern die Wiedererkennbarkeit des Clubs.
            </p>
            <p className="text-sm text-slate-600">
              Organisiere Assets in Ordnern und Tags für schnellen Zugriff. CDN-Integration und S3-Upload folgen.
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
            Kein aktiver Website-Eintrag gefunden.
          </p>
        </AdminSurfaceCard>
      )}

      <AddMediaForm />

      {site && (
        <>
          <MediaTypeFilter assets={assets} activeType={typeFilter} />
          <MediaGrid assets={assets} typeFilter={typeFilter} />
        </>
      )}

      <AdminSurfaceCard className="flex items-start gap-3 border-slate-100 bg-slate-50/60 p-5">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Roadmap: Drag &amp; Drop Upload, Bulk Upload, AI-Bildgenerierung, Bildvarianten, Mobile App Sync
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Die Mediathek-Architektur ist bereits CDN-ready und provider-unabhängig aufgebaut.
          </p>
        </div>
      </AdminSurfaceCard>
    </div>
  );
}
