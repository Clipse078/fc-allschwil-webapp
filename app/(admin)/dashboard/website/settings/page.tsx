import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/permissions/is-super-admin";
import SiteSettingsForm from "@/components/admin/website/SiteSettingsForm";
import DomainManagementSection from "@/components/admin/website/DomainManagementSection";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

type InfoboardDisplayOptions = {
  showClubLogo?: boolean;
  showClubName?: boolean;
  showSponsorRotation?: boolean;
  showDateTime?: boolean;
  showWeatherPlaceholder?: boolean;
  showDressingRooms?: boolean;
  showPitchNames?: boolean;
  showEventTypeIcons?: boolean;
  showAnnouncementTicker?: boolean;
  showEmergencyBanner?: boolean;
  showQrCode?: boolean;
  density?: string;
  sponsorVisibility?: string;
};

type SettingsJson = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  footerText?: string | null;
  websitePresetKey?: string | null;
  infoboardPresetKey?: string | null;
  infoboardMode?: string | null;
  infoboardDisplayOptions?: InfoboardDisplayOptions | null;
};

export default async function WebsiteSettingsPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const session = await auth();
  const superAdmin = isSuperAdmin(session);

  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey: SITE_TENANT_KEY },
    select: {
      id: true, name: true, tenantKey: true,
      locale: true, sport: true, domain: true, apexDomain: true,
      domainStatus: true, sslStatus: true, settingsJson: true,
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
        infoboardDisplayOptions={sj.infoboardDisplayOptions ?? {}}
        initialValues={{
          name: site?.name ?? "",
          locale: site?.locale ?? "de",
          sport: site?.sport ?? "football",
          domain: site?.domain ?? "",
          logoUrl: sj.logoUrl ?? "",
          primaryColor: sj.primaryColor ?? "",
          footerText: sj.footerText ?? "",
          websitePresetKey: sj.websitePresetKey ?? "",
          infoboardPresetKey: sj.infoboardPresetKey ?? "",
          infoboardMode: sj.infoboardMode ?? "",
        }}
      />

      {site && (
        <DomainManagementSection
          siteId={site.id}
          tenantKey={SITE_TENANT_KEY}
          initialDomain={site.domain ?? ""}
          initialApexDomain={site.apexDomain ?? ""}
          domainStatus={site.domainStatus}
          sslStatus={site.sslStatus}
          isSuperAdmin={superAdmin}
        />
      )}
    </div>
  );
}
