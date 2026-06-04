import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteNewsForm from "@/components/admin/website/WebsiteNewsForm";
import { getNewsPostByIdForAdmin } from "@/lib/website/news-queries";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditWebsiteNewsPage({ params }: PageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
  ]);
  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const { id } = await params;
  const post = await getNewsPostByIdForAdmin(tenantId, id);
  if (!post) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereins-News"
        title="Artikel bearbeiten"
        description={`Artikel „${post.title}" bearbeiten.`}
      />
      <WebsiteNewsForm post={post} tenantId={tenantId} />
    </div>
  );
}
