import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import StageEnvironmentBanner from "@/components/admin/deployment/StageEnvironmentBanner";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import AppTopNav from "@/components/admin/layout/AppTopNav";
import StopImpersonationButton from "@/components/admin/layout/StopImpersonationButton";
import { getCurrentTenantContext } from "@/lib/tenants/context";
import { generateTenantCssVars } from "@/lib/tenant-runtime/theme";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Use full tenant context to get both identity (name) and branding config.
  // generateTenantCssVars() applies PLATFORM_BRANDING defaults when null,
  // so the layout is always safe even if the tenant has no branding configured.
  const ctx = await getCurrentTenantContext();
  const tenantCssVars = generateTenantCssVars(ctx);

  return (
    <div
      className="flex min-h-screen bg-[var(--background)]"
      style={tenantCssVars as React.CSSProperties}
    >
      {/* Fixed sidebar */}
      <Suspense fallback={null}>
        <AdminSidebar
          firstName={session.user.firstName}
          lastName={session.user.lastName}
          email={session.user.email}
          permissionKeys={session.user.permissionKeys}
          clubName={ctx?.name}
          logoUrl={ctx?.logoUrl}
        />
      </Suspense>

      {/* Main content area — flex-1, no margin needed since sidebar is in flow */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Deployment environment banner */}
        <StageEnvironmentBanner />

        {/* Impersonation banner */}
        {session.user.isImpersonating ? (
          <div className="border-b border-amber-200 bg-amber-50/95 backdrop-blur-sm">
            <div className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                    Impersonation aktiv
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    Eingeloggt als anderer Benutzer —{" "}
                    Admin: {session.user.actorName ?? session.user.actorEmail ?? "Unbekannt"}
                  </p>
                </div>
                <StopImpersonationButton />
              </div>
            </div>
          </div>
        ) : null}

        {/* Sticky top navigation */}
        <AppTopNav
          firstName={session.user.firstName}
          lastName={session.user.lastName}
        />

        {/* Page content */}
        <main className="flex-1 px-6 py-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
