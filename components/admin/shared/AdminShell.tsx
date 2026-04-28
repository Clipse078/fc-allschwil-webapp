"use client";

import { useState } from "react";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import AdminHeaderMetaRow from "@/components/admin/layout/AdminHeaderMetaRow";
import AdminWatermark from "@/components/admin/shared/AdminWatermark";

type AdminShellProps = {
  children: React.ReactNode;
  firstName: string;
  lastName: string;
  email: string;
  permissionKeys: string[];
};

export default function AdminShell({
  children,
  firstName,
  lastName,
  email,
  permissionKeys,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const currentSeasonLabel = "2025/2026";
  const nextSeasonLabel = "2026/2027";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div
        className={
          collapsed
            ? "w-[84px] shrink-0 transition-all duration-300"
            : "w-[248px] shrink-0 transition-all duration-300"
        }
      >
        <AdminSidebar
          firstName={firstName}
          lastName={lastName}
          email={email}
          permissionKeys={permissionKeys}
          currentSeasonLabel={currentSeasonLabel}
          nextSeasonLabel={nextSeasonLabel}
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top_left,rgba(11,74,162,0.06),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_36%,#f1f5f9_100%)]">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 px-6 py-5 shadow-[0_14px_45px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className={collapsed ? "mx-auto flex w-full max-w-[1560px] items-start justify-between gap-6 transition-all duration-300" : "mx-auto flex w-full max-w-[1400px] items-start justify-between gap-6 transition-all duration-300"}>
            <div className="min-w-0 flex-1">
              <AdminPageHeader
                firstName={firstName}
                currentSeasonLabel={currentSeasonLabel}
                canManageSeasons={permissionKeys.includes("seasons.manage") || permissionKeys.includes("users.manage")}
              />
            </div>

            <AdminHeaderMetaRow
              currentSeasonLabel={currentSeasonLabel}
              firstName={firstName}
              lastName={lastName}
              roleLabel="Super Admin"
            />
          </div>
        </header>

        <main className="relative flex-1 px-4 py-7 md:px-6 md:py-8">
          <AdminWatermark />
          <div
            className={
              collapsed
                ? "mx-auto w-full max-w-[1560px] transition-all duration-300"
                : "mx-auto w-full max-w-[1400px] transition-all duration-300"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}


