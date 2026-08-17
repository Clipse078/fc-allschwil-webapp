import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { prisma } from "@/lib/db/prisma";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import NewsArticleList from "@/components/admin/news/NewsArticleList";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";

export default async function NewsAdminPage() {
  const session = await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);
  const tenantId = await requireActiveTenantId();

  const resolver = createEffectivePermissionResolver(prisma);
  const canDelete = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.NEWS_DELETE,
    tenantId,
  });

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Website"
        title="News"
        description="Newsartikel erstellen, prüfen, planen und veröffentlichen."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "News" },
        ]}
        headerActions={
          <Link href="/dashboard/website/news/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neue News erstellen
          </Link>
        }
      >
        <NewsArticleList canDelete={canDelete} />
      </ListPagePattern>
    </PageShell>
  );
}
