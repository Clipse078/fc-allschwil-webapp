import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Building2,
  Globe,
  Info,
  LayoutDashboard,
  Smartphone,
  Wifi,
  Zap,
} from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import SettingsSection from "@/components/admin/platform/SettingsSection";
import SettingsCard from "@/components/admin/platform/SettingsCard";
import SettingsField from "@/components/admin/platform/SettingsField";
import TenantPreviewCard from "@/components/admin/platform/TenantPreviewCard";
import { prisma } from "@/lib/db/prisma";
import { saveTenantBrandingAction } from "./actions";

// ── Status messages ────────────────────────────────────────────────────────────

const STATUS: Record<string, { text: string; tone: "success" | "warning" }> = {
  saved:            { text: "Tenant branding saved successfully.", tone: "success" },
  "missing-tenant": { text: "No tenant selected.", tone: "warning" },
  "missing-name":   { text: "Club name is required.", tone: "warning" },
  "not-found":      { text: "Tenant not found.", tone: "warning" },
};

// ── Platform feature stubs ─────────────────────────────────────────────────────

const FEATURES = [
  { id: "website_builder", label: "Website Builder",      icon: Globe,           desc: "Public club website with events, teams, and news." },
  { id: "mobile_app",      label: "Mobile App",           icon: Smartphone,       desc: "Native iOS and Android app for club members." },
  { id: "infoboard",       label: "InfoBoard",            icon: LayoutDashboard,  desc: "Real-time digital display for clubhouse screens." },
  { id: "communication",   label: "Communication Module", icon: Wifi,             desc: "Messaging, announcements, and push notifications." },
  { id: "attendance",      label: "Attendance Module",    icon: Zap,              desc: "Training and event attendance tracking." },
];

const inputCls =
  "w-full rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10";

const selectCls =
  "w-full rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10";

// ── Page ───────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams?: Promise<{ tenant?: string; status?: string }>;
};

export default async function PlatformSettingsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(session.user.roleKeys ?? []).includes("super_admin")) redirect("/dashboard");

  const resolved = (await searchParams) ?? {};
  const statusMsg = resolved.status ? STATUS[resolved.status] : null;

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      displayName: true,
      shortName: true,
      countryCode: true,
      sportType: true,
      primaryColor: true,
      secondaryColor: true,
      logoUrl: true,
      isActive: true,
    },
  });

  const tenant =
    (resolved.tenant ? tenants.find((t) => t.id === resolved.tenant) : null) ??
    tenants[0] ??
    null;

  return (
    <div className="space-y-8">

      <AdminSectionHeader
        eyebrow="Platform · Settings"
        title="Tenant Branding Center"
        description="Configure club identity, branding, and platform modules for each SportClubEvo tenant."
        actions={
          <Link href="/dashboard/tenants" className="fca-button-secondary">
            All Tenants
          </Link>
        }
      />

      {statusMsg ? (
        <div
          className={`rounded-[18px] border px-5 py-3.5 text-sm font-medium ${
            statusMsg.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {statusMsg.text}
        </div>
      ) : null}

      {/* Tenant tab selector */}
      {tenants.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No tenants found.</p>
          <Link href="/dashboard/tenants" className="mt-3 inline-block text-sm text-[#0b4aa2] underline">
            Create your first tenant
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tenants.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/platform/settings?tenant=${t.id}`}
              className={
                tenant?.id === t.id
                  ? "inline-flex items-center gap-2 rounded-full border border-[#0b4aa2]/25 bg-[#0b4aa2]/8 px-4 py-2 text-sm font-semibold text-[#0b4aa2]"
                  : "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              }
            >
              {t.displayName ?? t.name}
              {!t.isActive ? (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">
                  Off
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      {tenant ? (
        <div className="space-y-8">

          {/* ── Two-column: settings + sticky preview ─────────────────── */}
          <div className="grid gap-8 xl:grid-cols-[1fr_300px]">

            {/* Settings form */}
            <form action={saveTenantBrandingAction} className="space-y-8">
              <input type="hidden" name="tenantId" value={tenant.id} />

              {/* Section 1: Branding */}
              <SettingsSection
                eyebrow="Section 1"
                title="Tenant Branding"
                description="Identity elements that define how this club appears across the SportClubEvo platform."
              >
                <SettingsCard>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Club Name" htmlFor="name" required>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        defaultValue={tenant.name}
                        className={inputCls}
                        placeholder="FC Allschwil"
                      />
                    </SettingsField>

                    <SettingsField label="Display Name" htmlFor="displayName" hint="Shown in headers and navigation.">
                      <input
                        id="displayName"
                        name="displayName"
                        type="text"
                        defaultValue={tenant.displayName ?? ""}
                        className={inputCls}
                        placeholder="Same as Club Name"
                      />
                    </SettingsField>

                    <SettingsField label="Short Name / Abbreviation" htmlFor="shortName" hint="Used in compact UI contexts.">
                      <input
                        id="shortName"
                        name="shortName"
                        type="text"
                        defaultValue={tenant.shortName ?? ""}
                        className={inputCls}
                        placeholder="FCA"
                        maxLength={10}
                      />
                    </SettingsField>

                    <SettingsField label="Logo URL" htmlFor="logoUrl" hint="HTTPS link to a square PNG or SVG logo.">
                      <input
                        id="logoUrl"
                        name="logoUrl"
                        type="url"
                        defaultValue={tenant.logoUrl ?? ""}
                        className={inputCls}
                        placeholder="https://..."
                      />
                    </SettingsField>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Primary Color" htmlFor="primaryColor" hint="Main brand color — hex value.">
                      <div className="flex items-center gap-3">
                        <input
                          id="primaryColor"
                          name="primaryColor"
                          type="text"
                          defaultValue={tenant.primaryColor ?? ""}
                          className={`${inputCls} flex-1`}
                          placeholder="#0b4aa2"
                          maxLength={9}
                        />
                        {tenant.primaryColor ? (
                          <div
                            className="h-10 w-10 shrink-0 rounded-xl border-2 border-white shadow-md"
                            style={{ backgroundColor: tenant.primaryColor }}
                          />
                        ) : null}
                      </div>
                    </SettingsField>

                    <SettingsField label="Secondary Color" htmlFor="secondaryColor" hint="Accent / gradient color — hex value.">
                      <div className="flex items-center gap-3">
                        <input
                          id="secondaryColor"
                          name="secondaryColor"
                          type="text"
                          defaultValue={tenant.secondaryColor ?? ""}
                          className={`${inputCls} flex-1`}
                          placeholder="#4a6fd1"
                          maxLength={9}
                        />
                        {tenant.secondaryColor ? (
                          <div
                            className="h-10 w-10 shrink-0 rounded-xl border-2 border-white shadow-md"
                            style={{ backgroundColor: tenant.secondaryColor }}
                          />
                        ) : null}
                      </div>
                    </SettingsField>
                  </div>
                </SettingsCard>
              </SettingsSection>

              <div className="border-t border-slate-100" />

              {/* Section 2: Organisation */}
              <SettingsSection
                eyebrow="Section 2"
                title="Organisation"
                description="Club structure, region, and operational context."
              >
                <SettingsCard>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Country Code" htmlFor="countryCode">
                      <input
                        id="countryCode"
                        name="countryCode"
                        type="text"
                        defaultValue={tenant.countryCode}
                        className={inputCls}
                        placeholder="CH"
                        maxLength={3}
                      />
                    </SettingsField>

                    <SettingsField label="Sport Type" htmlFor="sportType">
                      <select
                        id="sportType"
                        name="sportType"
                        defaultValue={tenant.sportType}
                        className={selectCls}
                      >
                        <option value="football">Football</option>
                        <option value="basketball">Basketball</option>
                        <option value="volleyball">Volleyball</option>
                        <option value="hockey">Hockey</option>
                        <option value="tennis">Tennis</option>
                        <option value="other">Other</option>
                      </select>
                    </SettingsField>

                    <SettingsField label="Timezone" htmlFor="timezone" hint="Platform module — coming soon.">
                      <input
                        id="timezone"
                        name="timezone"
                        type="text"
                        disabled
                        defaultValue="Europe/Zurich"
                        className={`${inputCls} cursor-not-allowed opacity-50`}
                      />
                    </SettingsField>

                    <SettingsField label="Language" htmlFor="language" hint="Platform module — coming soon.">
                      <input
                        id="language"
                        name="language"
                        type="text"
                        disabled
                        defaultValue="de-CH"
                        className={`${inputCls} cursor-not-allowed opacity-50`}
                      />
                    </SettingsField>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-[13px] border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <input
                      id="isActive"
                      name="isActive"
                      type="checkbox"
                      defaultChecked={tenant.isActive}
                      value="on"
                      className="h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]/20"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                      Tenant active
                    </label>
                    <span className="text-xs text-slate-400">
                      — inactive tenants are hidden from the platform.
                    </span>
                  </div>
                </SettingsCard>
              </SettingsSection>

              {/* Save button */}
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button type="submit" className="fca-button-primary px-6 py-3 text-sm">
                  Save Branding
                </button>
              </div>
            </form>

            {/* Sticky preview panel */}
            <div className="hidden xl:block">
              <div className="sticky top-6">
                <TenantPreviewCard
                  displayName={tenant.displayName ?? tenant.name}
                  shortName={tenant.shortName ?? undefined}
                  slug={tenant.slug}
                  sportType={tenant.sportType}
                  primaryColor={tenant.primaryColor ?? "#0b4aa2"}
                  secondaryColor={tenant.secondaryColor ?? undefined}
                  logoUrl={tenant.logoUrl ?? undefined}
                  isActive={tenant.isActive}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Platform Features (below the grid, full width) */}
          <div className="border-t border-slate-100 pt-8">
            <SettingsSection
              eyebrow="Section 3"
              title="Platform Features"
              description="Enable or disable SportClubEvo modules for this club. Feature toggles will be enforced in a future release."
            >
              <SettingsCard>
                <ul className="space-y-3">
                  {FEATURES.map((feat) => {
                    const Icon = feat.icon;
                    return (
                      <li
                        key={feat.id}
                        className="flex items-start justify-between gap-4 rounded-[13px] border border-slate-100 bg-slate-50/50 px-4 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{feat.label}</p>
                            <p className="mt-0.5 text-[0.75rem] text-slate-500">{feat.desc}</p>
                          </div>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                          Coming soon
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 flex items-start gap-3 rounded-[13px] border border-blue-100 bg-blue-50/60 px-4 py-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <p className="text-[0.78rem] text-blue-800">
                    <span className="font-semibold">Future-ready foundation.</span>{" "}
                    Additional branding and website customization tools will become available in future SportClubEvo releases.
                    Feature toggles will control module access per tenant once backend enforcement is in place.
                  </p>
                </div>
              </SettingsCard>
            </SettingsSection>
          </div>

        </div>
      ) : null}
    </div>
  );
}
