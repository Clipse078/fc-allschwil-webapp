import type { TenantStatus } from "@prisma/client";

/** Canonical DB lifecycle states — reconciled with existing TenantStatus enum. */
export type TenantLifecycleStatus = TenantStatus;

/**
 * Operational labels derived from TenantStatus + tenant signals.
 * ONBOARDING is not a separate DB state; it is computed for platform ops UI.
 */
export type TenantOperationalPhase =
  | "ACTIVE"
  | "ONBOARDING"
  | "SUSPENDED"
  | "ARCHIVED";

export type TenantAttentionCode =
  | "NO_ACTIVE_ADMIN"
  | "SUSPENDED"
  | "INCOMPLETE_CONFIG"
  | "ONBOARDING";

export type TenantAttentionItem = {
  code: TenantAttentionCode;
  label: string;
  severity: "warning" | "danger" | "info";
};

export type TenantLifecycleAction =
  | "activate"
  | "suspend"
  | "reactivate"
  | "archive";

export const TENANT_LIFECYCLE_AUDIT_ACTIONS = {
  CREATED: "tenant_created",
  ACTIVATED: "tenant_activated",
  SUSPENDED: "tenant_suspended",
  REACTIVATED: "tenant_reactivated",
  ARCHIVED: "tenant_archived",
  STATUS_CHANGED: "tenant_status_changed",
} as const;

export type TenantRegistryStatusFilter =
  | "all"
  | "active"
  | "onboarding"
  | "suspended"
  | "archived"
  | "attention";
