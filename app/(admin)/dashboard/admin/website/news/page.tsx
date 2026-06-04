import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteNewsTable from "@/components/admin/website/WebsiteNewsTable";
import { getNewsPostsForAdmin } from "@/lib/website/news-queries";

export default async function WebsiteNewsListPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
  ]);
  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const canManage = hasAnyPermission(session, [
    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
  ]);

  const posts = await getNewsPostsForAdmin(tenantId).catch(() => []);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website-Verwaltung"
        title="Vereins-News"
        description="Artikel erstellen, bearbeiten und veröffentlichen. Publizierte Artikel erscheinen sofort auf der öffentlichen Website."
      />
      <WebsiteNewsTable initialPosts={posts} canManage={canManage} />
    </div>
  );
}
