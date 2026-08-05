import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import BrandingSettingsForm from "@/components/admin/branding/BrandingSettingsForm";

// Branding management for the authenticated user's own tenant.
// Tenant resolved through the single tenant-context helper (RPERM-04) — no URL slug required.
// Permission: USERS_MANAGE (club admin level) — no TENANTS_MANAGE needed.

export default async function BrandingPage() {
  await requireAnyPermission([PERMISSIONS.USERS_MANAGE]);
  const ctx = await getActiveTenant();
  if (!ctx) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Admin"
        title="Darstellung"
        description="Logo und Vereinsfarben konfigurieren. Änderungen wirken sich sofort auf die Seitenleiste, das Dashboard und alle Branding-Oberflächen aus."
      />
      <BrandingSettingsForm
        tenantName={ctx.name}
        defaultValues={{
          logoUrl: ctx.logoUrl,
          primaryColor: ctx.primaryColor,
          secondaryColor: ctx.secondaryColor,
        }}
      />
    </div>
  );
}
