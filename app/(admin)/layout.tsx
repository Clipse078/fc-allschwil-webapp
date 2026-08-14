import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import StageEnvironmentBanner from "@/components/admin/deployment/StageEnvironmentBanner";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import AppTopNav from "@/components/admin/layout/AppTopNav";
import StopImpersonationButton from "@/components/admin/layout/StopImpersonationButton";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { generateTenantCssVars } from "@/lib/tenant-runtime/theme";
import { getPersonNameByUserId } from "@/lib/people/queries";
import { resolveAccountIdentityName } from "@/lib/people/identity";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // RPERM-04: resolve tenant context through the single tenant-resolution helper
  // (session.user.activeTenantId, derived from TenantMembership — never the legacy
  // User.tenantId column). generateTenantCssVars() applies PLATFORM_BRANDING
  // defaults when null, so the layout is always safe even for platform-only
  // administrators with no active tenant.
  const ctx = await getActiveTenant();
  const tenantCssVars = generateTenantCssVars(ctx);

  // DASHBOARD-SHELL-UX-01-C2: the sidebar footer identity (directly above
  // "Abmelden") must render the authenticated human person's name, not the
  // raw User.firstName/lastName columns — for some bootstrapped tenant
  // accounts those hold the club name and role label instead (e.g. "FC
  // Allschwil" / "Club Admin"). Prefer the canonically linked Person's name
  // (Person.userId, ADMIN-MASTERDATA-UX-01), same relationship already used
  // for the dashboard greeting. See lib/people/identity.ts for the fallback
  // rule.
  // INVITE-01: pass activeTenantId so lookup is scoped to the current tenant
  // (Person.userId is now per-tenant unique, not globally unique).
  const linkedPersonName = await getPersonNameByUserId(
    session.user.id,
    session.user.activeTenantId ?? undefined,
  );
  const sidebarIdentity = resolveAccountIdentityName({
    linkedPerson: linkedPersonName,
    sessionFirstName: session.user.firstName,
    sessionLastName: session.user.lastName,
    tenantName: ctx?.name,
  });

  return (
    <div
      className="flex min-h-screen bg-[var(--background)]"
      style={tenantCssVars as React.CSSProperties}
    >
      {/* Fixed sidebar */}
      <Suspense fallback={null}>
        <AdminSidebar
          firstName={sidebarIdentity.firstName}
          lastName={sidebarIdentity.lastName}
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
