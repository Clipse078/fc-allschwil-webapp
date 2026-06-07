import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import MediaLibraryPageView from "@/components/admin/media/MediaLibraryPageView";

export default async function MediaLibraryPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);
  return <MediaLibraryPageView />;
}
