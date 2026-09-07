import type { TenantLifecycleStatus } from "@/lib/tenants/platform-ops/types";
import type { TenantOperationalPhase } from "@/lib/tenants/platform-ops/types";

export function getLifecycleStatusLabel(status: TenantLifecycleStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Aktiv";
    case "INACTIVE":
      return "Suspendiert";
    case "ARCHIVED":
      return "Archiviert";
    default:
      return status;
  }
}

export function getOperationalPhaseLabel(phase: TenantOperationalPhase): string {
  switch (phase) {
    case "ACTIVE":
      return "Aktiv";
    case "ONBOARDING":
      return "Onboarding";
    case "SUSPENDED":
      return "Suspendiert";
    case "ARCHIVED":
      return "Archiviert";
    default:
      return phase;
  }
}

export function mapStatusToOperationalPhase(
  status: TenantLifecycleStatus,
  isOnboarding: boolean,
): TenantOperationalPhase {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (status === "INACTIVE") return "SUSPENDED";
  if (isOnboarding) return "ONBOARDING";
  return "ACTIVE";
}
