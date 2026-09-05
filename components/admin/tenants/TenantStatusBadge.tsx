"use client";

import type { TenantLifecycleStatus, TenantOperationalPhase } from "@/lib/tenants/platform-ops/types";
import { getLifecycleStatusLabel, getOperationalPhaseLabel } from "@/lib/tenants/platform-ops/labels";

type TenantStatusBadgeProps = {
  status?: TenantLifecycleStatus;
  operationalPhase?: TenantOperationalPhase;
  size?: "sm" | "md";
};

const STATUS_STYLES: Record<
  TenantLifecycleStatus | TenantOperationalPhase,
  { label: string; bg: string; color: string }
> = {
  ACTIVE: { label: "Aktiv", bg: "var(--sce-success-light)", color: "var(--sce-success)" },
  ONBOARDING: { label: "Onboarding", bg: "var(--sce-info-light)", color: "var(--sce-info)" },
  INACTIVE: { label: "Suspendiert", bg: "var(--sce-warning-light)", color: "var(--sce-warning)" },
  SUSPENDED: { label: "Suspendiert", bg: "var(--sce-warning-light)", color: "var(--sce-warning)" },
  ARCHIVED: { label: "Archiviert", bg: "var(--sce-danger-light)", color: "var(--sce-danger)" },
};

export default function TenantStatusBadge({
  status,
  operationalPhase,
  size = "sm",
}: TenantStatusBadgeProps) {
  const key = operationalPhase ?? status ?? "ACTIVE";
  const cfg = STATUS_STYLES[key] ?? {
    label: status ? getLifecycleStatusLabel(status) : getOperationalPhaseLabel(key as TenantOperationalPhase),
    bg: "var(--surface-3)",
    color: "var(--muted)",
  };

  const padding = size === "md" ? "px-3 py-1.5 text-[0.75rem]" : "px-2.5 py-1 text-[0.72rem]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding}`}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}
