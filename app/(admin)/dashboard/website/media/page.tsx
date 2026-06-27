import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import MediaLibraryDAM from "@/components/admin/media/MediaLibraryDAM";

export default async function MediaLibraryPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Medienbibliothek
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Digitale Asset-Verwaltung — Bilder und Videos hochladen, organisieren und wiederverwenden.
        </p>
      </div>
      <MediaLibraryDAM />
    </div>
  );
}
