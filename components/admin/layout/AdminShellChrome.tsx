import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import StageEnvironmentBanner from "@/components/admin/deployment/StageEnvironmentBanner";
import AdminHeaderDateTime from "@/components/admin/layout/AdminHeaderDateTime";
import AdminPageActions from "@/components/admin/layout/AdminPageActions";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import StopImpersonationButton from "@/components/admin/layout/StopImpersonationButton";
import FcaBrandCrest from "@/components/shared/FcaBrandCrest";

type AdminShellChromeProps = {
  firstName: string;
  lastName: string;
  email: string;
  permissionKeys: string[];
  isImpersonating: boolean;
  actorName: string | null;
  actorEmail: string | null;
  children: ReactNode;
};

/**
 * AdminShellChrome — server component.
 *
 * Provides the full admin chrome: glows, SVG watermark, sidebar, stage banner,
 * impersonation bar, top header (route-aware title + actions + datetime),
 * user display, and main content area.
 *
 * NextIntlClientProvider is placed here so that every client component inside
 * (AdminSidebar, AdminPageActions, SignOutButton, etc.) can call useTranslations().
 * Locale and messages are resolved by i18n/request.ts via the next-intl plugin.
 */
export default async function AdminShellChrome({
  firstName,
  lastName,
  email,
  permissionKeys,
  isImpersonating,
  actorName,
  actorEmail,
  children,
}: AdminShellChromeProps) {
  const [tAuth, messages] = await Promise.all([
    getTranslations("auth"),
    getMessages(),
  ]);

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="fca-admin-shell text-slate-900">
        <div className="fca-admin-glow fca-admin-glow-blue left-[-120px] top-[140px] h-[320px] w-[320px]" />
        <div className="fca-admin-glow fca-admin-glow-red bottom-[40px] right-[-120px] h-[320px] w-[320px]" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[140px] h-[900px] w-[900px] -translate-x-1/2 opacity-[0.07]">
            <FcaBrandCrest className="h-full w-full" variant="watermark" />
          </div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-[1800px]">
          <AdminSidebar
            firstName={firstName}
            lastName={lastName}
            email={email}
            permissionKeys={permissionKeys}
          />

          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <StageEnvironmentBanner />

            {isImpersonating ? (
              <div className="border-b border-amber-200 bg-amber-50/95 backdrop-blur-sm">
                <div className="px-6 py-4 lg:px-8 2xl:px-10">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        {tAuth("impersonationActive")}
                      </p>
                      <p className="mt-1 text-sm text-amber-900">
                        {tAuth("impersonationDescription")}
                      </p>
                      <p className="mt-1 text-xs text-amber-800">
                        Admin: {actorName ?? actorEmail ?? tAuth("unknownAdmin")}
                      </p>
                    </div>

                    <StopImpersonationButton />
                  </div>
                </div>
              </div>
            ) : null}

            <header className="border-b border-slate-200 bg-white/78 backdrop-blur-xl">
              <div className="px-6 py-6 lg:px-8 2xl:px-10">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <AdminPageHeader />
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-4 xl:items-end">
                    <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center xl:justify-end">
                      <AdminPageActions />
                      <AdminHeaderDateTime />
                    </div>

                    <div className="text-left xl:text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {firstName} {lastName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{email}</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <main className="relative flex-1 px-6 py-6 lg:px-8 lg:py-7 2xl:px-10">
              {children}
            </main>
          </div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
