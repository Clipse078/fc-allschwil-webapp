import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import SiteSettingsForm from "@/components/admin/website/SiteSettingsForm";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

type SettingsJson = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  footerText?: string | null;
};

export default async function WebsiteSettingsPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey: SITE_TENANT_KEY },
    select: {
      id: true, name: true, tenantKey: true,
      locale: true, sport: true, domain: true, settingsJson: true,
    },
  });

  const sj = (site?.settingsJson ?? {}) as SettingsJson;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href="/dashboard/website"
          className="mt-1 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Website
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Website Einstellungen</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Konfiguration der öffentlichen Website und des Tenants
          </p>
        </div>
      </div>

      <SiteSettingsForm
        tenantKey={SITE_TENANT_KEY}
        initialValues={{
          name: site?.name ?? "",
          locale: site?.locale ?? "de",
          sport: site?.sport ?? "football",
          domain: site?.domain ?? "",
          logoUrl: sj.logoUrl ?? "",
          primaryColor: sj.primaryColor ?? "",
          footerText: sj.footerText ?? "",
        }}
      />
    </div>
  );
}
