import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { getTenantDetailData } from "@/lib/tenants/queries";
import { updateTenantAction } from "../actions";

type TenantDetailPageProps = {
  params: Promise<{
    tenantId: string;
  }>;
  searchParams?: Promise<{
    status?: string;
  }>;
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "warning" }> = {
  "update-success": { text: "Tenant erfolgreich aktualisiert.", tone: "success" },
  "update-missing-name": { text: "Name ist erforderlich.", tone: "warning" },
  "update-missing-id": { text: "Tenant-ID fehlt.", tone: "warning" },
  "update-not-found": { text: "Tenant nicht gefunden.", tone: "warning" },
};

export default async function TenantDetailPage({ params, searchParams }: TenantDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isSuperAdmin = (session.user.roleKeys ?? []).includes("super_admin");

  if (!isSuperAdmin) {
    redirect("/dashboard");
  }

  const { tenantId } = await params;
  const tenant = await getTenantDetailData(tenantId);

  if (!tenant) {
    notFound();
  }

  const resolvedParams = (await searchParams) ?? {};
  const statusMessage = resolvedParams.status
    ? STATUS_MESSAGES[resolvedParams.status]
    : null;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Platform · Tenants"
        title="Tenant bearbeiten"
        description="Stammdaten, Branding und Status dieses Tenants verwalten."
        actions={
          <Link href="/dashboard/tenants" className="fca-button-secondary">
            Zurück zu Tenants
          </Link>
        }
      />

      {statusMessage ? (
        <div
          className={`rounded-[20px] border px-5 py-4 text-sm font-medium ${
            statusMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {statusMessage.text}
        </div>
      ) : null}

      <AdminSurfaceCard className="p-6">
        <div className="mb-6">
          <p className="fca-eyebrow">Tenant-ID</p>
          <code className="mt-1 block rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600">
            {tenant.id}
          </code>
          <p className="mt-2 text-xs text-slate-400">
            Slug: <strong className="text-slate-600">{tenant.slug}</strong>{" "}
            — Slug bleibt nach der Erstellung stabil.
          </p>
        </div>

        <form action={updateTenantAction} className="space-y-4">
          <input type="hidden" name="tenantId" value={tenant.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-name"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-name"
                type="text"
                name="name"
                required
                defaultValue={tenant.name}
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
            </div>

            <div>
              <label
                htmlFor="edit-display-name"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Anzeigename (optional)
              </label>
              <input
                id="edit-display-name"
                type="text"
                name="displayName"
                defaultValue={tenant.displayName ?? ""}
                placeholder="Abweichender Anzeigename"
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-country"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Land
              </label>
              <input
                id="edit-country"
                type="text"
                name="countryCode"
                defaultValue={tenant.countryCode}
                maxLength={3}
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
            </div>

            <div>
              <label
                htmlFor="edit-sport"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Sportart
              </label>
              <select
                id="edit-sport"
                name="sportType"
                defaultValue={tenant.sportType}
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              >
                <option value="football">Fussball</option>
                <option value="basketball">Basketball</option>
                <option value="volleyball">Volleyball</option>
                <option value="hockey">Hockey</option>
                <option value="other">Andere</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-color"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Primärfarbe (optional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-color"
                  type="text"
                  name="primaryColor"
                  defaultValue={tenant.primaryColor ?? ""}
                  placeholder="#0b4aa2"
                  className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
                />
                {tenant.primaryColor ? (
                  <div
                    className="h-9 w-9 shrink-0 rounded-full border border-slate-200"
                    style={{ backgroundColor: tenant.primaryColor }}
                  />
                ) : null}
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-logo"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Logo URL (optional)
              </label>
              <input
                id="edit-logo"
                type="url"
                name="logoUrl"
                defaultValue={tenant.logoUrl ?? ""}
                placeholder="https://..."
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="edit-active"
              type="checkbox"
              name="isActive"
              value="on"
              defaultChecked={tenant.isActive}
              className="h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]/20"
            />
            <label htmlFor="edit-active" className="text-sm font-medium text-slate-700">
              Aktiv
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              Erstellt:{" "}
              {new Date(tenant.createdAt).toLocaleDateString("de-CH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
              {" · "}
              Zuletzt aktualisiert:{" "}
              {new Date(tenant.updatedAt).toLocaleDateString("de-CH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>

            <button type="submit" className="fca-button-primary">
              Speichern
            </button>
          </div>
        </form>
      </AdminSurfaceCard>
    </div>
  );
}
