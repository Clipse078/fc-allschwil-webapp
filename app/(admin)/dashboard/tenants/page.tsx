import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { getTenantsListData } from "@/lib/tenants/queries";
import { createTenantAction } from "./actions";

type TenantsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "warning" }> = {
  "create-success": { text: "Tenant erfolgreich erstellt.", tone: "success" },
  "create-missing-name": { text: "Name ist erforderlich.", tone: "warning" },
  "create-invalid-slug": { text: "Ungültiger Slug.", tone: "warning" },
  "create-slug-exists": { text: "Ein Tenant mit diesem Slug existiert bereits.", tone: "warning" },
};

export default async function TenantsPage({ searchParams }: TenantsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isSuperAdmin = (session.user.roleKeys ?? []).includes("super_admin");

  if (!isSuperAdmin) {
    redirect("/dashboard");
  }

  const params = (await searchParams) ?? {};
  const statusMessage = params.status ? STATUS_MESSAGES[params.status] : null;

  const tenants = await getTenantsListData();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Platform"
        title="Tenants / Clubs"
        description="Tenants sind die Grundlage von SportClubEvo. Jede Vereinsdaten, Module und Branding werden durch den jeweiligen Tenant gesteuert."
      />

      <div className="rounded-[28px] border border-blue-100 bg-blue-50/60 px-6 py-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Tenants sind die Grundlage von SportClubEvo.</span>{" "}
            Jede Vereinsdaten, Module und Branding werden durch den jeweiligen Tenant gesteuert.
            Jeder Verein erhält seinen eigenen Tenant mit eigenem Slug, Farben und Konfiguration.
          </p>
        </div>
      </div>

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
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm">
            <Plus className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Neuer Tenant</h3>
        </div>

        <form action={createTenantAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tenant-name"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="tenant-name"
                type="text"
                name="name"
                required
                placeholder="FC Allschwil"
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
              <p className="mt-1.5 text-xs text-slate-400">Slug wird automatisch generiert</p>
            </div>

            <div>
              <label
                htmlFor="tenant-slug"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Slug
              </label>
              <input
                id="tenant-slug"
                type="text"
                name="slug"
                placeholder="fc-allschwil (auto)"
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Leer lassen für automatische Generierung aus dem Namen
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tenant-country"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Land
              </label>
              <input
                id="tenant-country"
                type="text"
                name="countryCode"
                defaultValue="CH"
                placeholder="CH"
                maxLength={3}
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
            </div>

            <div>
              <label
                htmlFor="tenant-sport"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Sportart
              </label>
              <select
                id="tenant-sport"
                name="sportType"
                defaultValue="football"
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
                htmlFor="tenant-color"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Primärfarbe (optional)
              </label>
              <input
                id="tenant-color"
                type="text"
                name="primaryColor"
                placeholder="#0b4aa2"
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
            </div>

            <div>
              <label
                htmlFor="tenant-logo"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Logo URL (optional)
              </label>
              <input
                id="tenant-logo"
                type="url"
                name="logoUrl"
                placeholder="https://..."
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="tenant-active"
              type="checkbox"
              name="isActive"
              value="on"
              defaultChecked
              className="h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]/20"
            />
            <label htmlFor="tenant-active" className="text-sm font-medium text-slate-700">
              Aktiv
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="fca-button-primary">
              Tenant erstellen
            </button>
          </div>
        </form>
      </AdminSurfaceCard>

      <section className="space-y-4">
        <AdminSectionHeader
          eyebrow="Übersicht"
          title={`Alle Tenants (${tenants.length})`}
          description="Alle registrierten Clubs und Organisationen auf dieser Plattform."
        />

        {tenants.length === 0 ? (
          <AdminSurfaceCard className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Noch keine Tenants</p>
                <p className="mt-1 text-sm text-slate-500">
                  Erstelle den ersten Tenant, um loszulegen.
                </p>
              </div>
            </div>
          </AdminSurfaceCard>
        ) : (
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="group rounded-[24px] border border-slate-200 bg-white/95 p-5 shadow-sm transition duration-200 hover:-translate-y-[1px] hover:shadow-[0_18px_34px_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[#0b4aa2] shadow-sm"
                      style={
                        tenant.primaryColor
                          ? { borderColor: tenant.primaryColor, color: tenant.primaryColor }
                          : undefined
                      }
                    >
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {tenant.displayName ?? tenant.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
                          {tenant.slug}
                        </code>
                        {" · "}
                        {tenant.countryCode}
                        {" · "}
                        {tenant.sportType}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 lg:items-end">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusPill
                        label={tenant.isActive ? "Aktiv" : "Inaktiv"}
                        tone={tenant.isActive ? "success" : "muted"}
                      />
                      <span className="text-xs text-slate-400">
                        {new Date(tenant.createdAt).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {tenant.primaryColor ? (
                        <div
                          className="h-4 w-4 rounded-full border border-slate-200"
                          style={{ backgroundColor: tenant.primaryColor }}
                          title={`Farbe: ${tenant.primaryColor}`}
                        />
                      ) : null}
                      <Link
                        href={`/dashboard/tenants/${tenant.id}`}
                        className="fca-button-secondary text-xs"
                      >
                        Bearbeiten
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
