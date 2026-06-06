import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { listMediaAssets } from "@/lib/media/queries";
import AdminPageIntro from "@/components/admin/shared/AdminPageIntro";
import MediaLibraryClient from "@/components/admin/media/MediaLibraryClient";

export default async function MediaLibraryPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const tenant = await getTenantFromSession(session.user.tenantId);
  if (!tenant) {
    return (
      <div className="text-sm text-[var(--muted)]">Tenant nicht gefunden.</div>
    );
  }

  const { assets, total } = await listMediaAssets({
    tenantId: tenant.id,
    status: "ACTIVE",
    limit: 200,
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <AdminPageIntro
        eyebrow="Website · Medien"
        title="Medien-Bibliothek"
        description="Zentrale Ablage für alle hochgeladenen Bilder und Dokumente. Medien werden wiederverwendet — keine doppelten Uploads."
      />

      <MediaLibraryClient assets={assets} total={total} />
    </div>
  );
}
