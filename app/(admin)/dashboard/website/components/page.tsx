import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import ReusableComponentsLibrary from "@/components/admin/reusable-components/ReusableComponentsLibrary";

export default async function ReusableComponentsPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Wiederverwendbare Inhalte
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Komponenten einmal erstellen — in Homepage, Seiten, News und weiteren Modulen referenzieren.
        </p>
      </div>
      <ReusableComponentsLibrary />
    </div>
  );
}
