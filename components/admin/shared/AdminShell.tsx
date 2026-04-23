"use client";

import { useState } from "react";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import AdminHeaderDateTime from "@/components/admin/layout/AdminHeaderDateTime";
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
          currentSeasonLabel="2025/2026"
          nextSeasonLabel="2026/2027"
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-4">
          <AdminHeaderDateTime />
        </header>

        <main className="relative flex-1 px-4 py-4 md:px-6 md:py-6">
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
