import type { ReactNode } from "react";
import { getPublicSiteData } from "@/lib/website/public-queries";
import { buildTheme } from "@/lib/website/theme-engine";
import PublicWebsiteHeader from "@/components/public/layout/PublicWebsiteHeader";
import PublicWebsiteFooter from "@/components/public/layout/PublicWebsiteFooter";

type TenantLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantKey: string }>;
};

export default async function TenantPublicLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { tenantKey } = await params;
  const site = await getPublicSiteData(tenantKey);
  const theme = buildTheme(site ?? { name: tenantKey });

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <PublicWebsiteHeader theme={theme} tenantKey={tenantKey} />
      <div className="flex-1">{children}</div>
      <PublicWebsiteFooter theme={theme} tenantKey={tenantKey} />
    </div>
  );
}
