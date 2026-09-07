import type {
  TenantAttentionItem,
  TenantLifecycleStatus,
} from "@/lib/tenants/platform-ops/types";

type AttentionInput = {
  status: TenantLifecycleStatus;
  activeClubAdminCount: number;
  activeMemberCount: number;
  countryCode: string | null;
  locale: string | null;
  timezone: string | null;
};

export function isOnboardingTenant(input: AttentionInput): boolean {
  if (input.status !== "ACTIVE") return false;
  return input.activeClubAdminCount === 0;
}

export function hasIncompleteConfig(input: AttentionInput): boolean {
  if (input.status === "ARCHIVED") return false;
  return !input.countryCode || !input.locale || !input.timezone;
}

export function deriveTenantAttention(input: AttentionInput): TenantAttentionItem[] {
  const items: TenantAttentionItem[] = [];

  if (input.status === "INACTIVE") {
    items.push({
      code: "SUSPENDED",
      label: "Tenant ist suspendiert",
      severity: "danger",
    });
  }

  if (input.activeClubAdminCount === 0 && input.status !== "ARCHIVED") {
    items.push({
      code: "NO_ACTIVE_ADMIN",
      label: "Kein aktiver Club-Administrator",
      severity: input.status === "ACTIVE" ? "warning" : "danger",
    });
  }

  if (isOnboardingTenant(input)) {
    items.push({
      code: "ONBOARDING",
      label: "Onboarding — Administrator fehlt",
      severity: "info",
    });
  }

  if (hasIncompleteConfig(input)) {
    items.push({
      code: "INCOMPLETE_CONFIG",
      label: "Unvollständige Tenant-Konfiguration",
      severity: "warning",
    });
  }

  return items;
}

export function tenantNeedsAttention(input: AttentionInput): boolean {
  return deriveTenantAttention(input).length > 0;
}
