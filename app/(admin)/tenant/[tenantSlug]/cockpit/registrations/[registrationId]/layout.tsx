import type { ReactNode } from "react";
import CockpitTenantBanner from "@/components/admin/branding/CockpitTenantBanner";

type Props = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string; registrationId: string }>;
};

export default async function RegistrationDetailLayout({ children, params }: Props) {
  const { tenantSlug } = await params;

  return (
    <>
      <CockpitTenantBanner tenantSlug={tenantSlug} />
      {children}
    </>
  );
}
