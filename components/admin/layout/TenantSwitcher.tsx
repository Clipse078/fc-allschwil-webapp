"use client";

import { Building2, ChevronsUpDown } from "lucide-react";
import type { SessionTenant } from "@/types/next-auth";

type TenantSwitcherProps = {
  availableTenants: SessionTenant[];
  activeTenantName: string;
  activeTenantSlug: string;
  collapsed: boolean;
};

export default function TenantSwitcher({
  availableTenants,
  activeTenantName,
  activeTenantSlug,
  collapsed,
}: TenantSwitcherProps) {
  const displayName = activeTenantName || activeTenantSlug || "No tenant";
  const hasMultiple = availableTenants.length > 1;

  // Collapsed: icon only
  if (collapsed) {
    return (
      <div className="flex justify-center px-4 pb-1">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white"
          title={displayName}
        >
          <Building2 className="h-4 w-4 text-slate-500" />
        </div>
      </div>
    );
  }

  // Single tenant — readonly display
  if (!hasMultiple) {
    return (
      <div className="mx-5 mb-1">
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3.5 py-2.5 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Building2 className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Active club
            </p>
            <p className="truncate text-xs font-semibold text-slate-700">
              {displayName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Multiple tenants — disabled dropdown placeholder
  return (
    <div className="mx-5 mb-1">
      <div className="group relative">
        <button
          type="button"
          disabled
          title="Tenant switching coming soon"
          className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3.5 py-2.5 shadow-sm opacity-80"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Building2 className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Active club
            </p>
            <p className="truncate text-xs font-semibold text-slate-700">
              {displayName}
            </p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>

        {/* Tooltip */}
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-max max-w-[200px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg group-hover:block">
          <p className="text-[0.7rem] font-semibold text-slate-700">
            {availableTenants.length} tenants available
          </p>
          <p className="mt-0.5 text-[0.65rem] text-slate-500">
            Switching coming next
          </p>
        </div>
      </div>
    </div>
  );
}
