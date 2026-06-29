import { Menu } from "lucide-react";
import Link from "next/link";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import NavigationVisualBuilder from "@/components/admin/navigation/NavigationVisualBuilder";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";

export default async function NavigationManagementPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Navigation" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="Navigation"
          description="Visueller Builder: Baumansicht + Inspector. Header-, Footer- und Utility-Navigation verwalten."
          className="mb-0"
        />
      </div>

      {/* Back link */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={CMS_ROUTES.overview} className="fca-button-secondary text-xs">
          ← CMS Übersicht
        </Link>
        <p className="text-[10px] text-[var(--muted)] self-center ml-2">
          Öffentliche API:{" "}
          <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono">
            GET /api/public/[tenant]/website/navigation
          </code>
        </p>
      </div>

      {/* CMS V4.2: NavigationVisualBuilder — tree + Inspector + preview */}
      <NavigationVisualBuilder />
    </PageShell>
  );
}
