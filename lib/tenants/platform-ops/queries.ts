import { prisma } from "@/lib/db/prisma";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import {
  deriveTenantAttention,
  isOnboardingTenant,
  tenantNeedsAttention,
} from "@/lib/tenants/platform-ops/attention";
import { mapStatusToOperationalPhase } from "@/lib/tenants/platform-ops/labels";
import type {
  TenantOperationalPhase,
  TenantRegistryStatusFilter,
} from "@/lib/tenants/platform-ops/types";
import { TENANT_LIFECYCLE_AUDIT_ACTIONS } from "@/lib/tenants/platform-ops/types";

const registryTenantSelect = {
  id: true,
  key: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  countryCode: true,
  locale: true,
  timezone: true,
  websiteEnabled: true,
} as const;

type RegistryTenantRow = {
  id: string;
  key: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
  countryCode: string | null;
  locale: string | null;
  timezone: string | null;
  websiteEnabled: boolean;
};

export type TenantRegistryItem = RegistryTenantRow & {
  operationalPhase: TenantOperationalPhase;
  activeClubAdminCount: number;
  activeMemberCount: number;
  attentionItems: ReturnType<typeof deriveTenantAttention>;
  needsAttention: boolean;
  lastActivityAt: Date;
};

export type PlatformOpsOverview = {
  totals: {
    all: number;
    active: number;
    onboarding: number;
    suspended: number;
    archived: number;
    needsAttention: number;
  };
  attentionTenants: Array<{
    id: string;
    key: string;
    name: string;
    operationalPhase: TenantOperationalPhase;
    attentionItems: ReturnType<typeof deriveTenantAttention>;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: Date;
    tenantId: string | null;
    tenantKey: string | null;
    tenantName: string | null;
    actorName: string | null;
    actorEmail: string | null;
    summary: string;
  }>;
};

async function countActiveClubAdmins(
  tenantId: string,
  tenantKey: string,
): Promise<number> {
  const roleKey = getTenantClubAdminRoleKey(tenantKey);
  return prisma.tenantMembership.count({
    where: {
      tenantId,
      isActive: true,
      user: {
        isActive: true,
        userRoles: {
          some: {
            tenantId,
            role: { key: roleKey, isArchived: false },
          },
        },
      },
    },
  });
}

async function countActiveMembers(tenantId: string): Promise<number> {
  return prisma.tenantMembership.count({
    where: {
      tenantId,
      isActive: true,
      user: { isActive: true },
    },
  });
}

async function getLatestAuditActivity(tenantIds: string[]): Promise<Map<string, Date>> {
  if (tenantIds.length === 0) return new Map();

  const logs = await prisma.auditLog.findMany({
    where: { tenantId: { in: tenantIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["tenantId"],
    select: { tenantId: true, createdAt: true },
  });

  return new Map(
    logs
      .filter((log): log is { tenantId: string; createdAt: Date } => log.tenantId !== null)
      .map((log) => [log.tenantId, log.createdAt]),
  );
}

async function enrichTenantRow(
  tenant: RegistryTenantRow,
  latestAuditByTenant: Map<string, Date>,
): Promise<TenantRegistryItem> {
  const [activeClubAdminCount, activeMemberCount] = await Promise.all([
    countActiveClubAdmins(tenant.id, tenant.key),
    countActiveMembers(tenant.id),
  ]);

  const attentionInput = {
    status: tenant.status,
    activeClubAdminCount,
    activeMemberCount,
    countryCode: tenant.countryCode,
    locale: tenant.locale,
    timezone: tenant.timezone,
  };

  const attentionItems = deriveTenantAttention(attentionInput);
  const onboarding = isOnboardingTenant(attentionInput);

  return {
    ...tenant,
    operationalPhase: mapStatusToOperationalPhase(tenant.status, onboarding),
    activeClubAdminCount,
    activeMemberCount,
    attentionItems,
    needsAttention: tenantNeedsAttention(attentionInput),
    lastActivityAt:
      latestAuditByTenant.get(tenant.id) ?? tenant.updatedAt ?? tenant.createdAt,
  };
}

export async function getTenantRegistryItems(
  statusFilter: TenantRegistryStatusFilter = "all",
): Promise<TenantRegistryItem[]> {
  const tenants = await prisma.tenant.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: registryTenantSelect,
  });

  const latestAuditByTenant = await getLatestAuditActivity(
    tenants.map((tenant) => tenant.id),
  );

  const enriched = await Promise.all(
    tenants.map((tenant) => enrichTenantRow(tenant, latestAuditByTenant)),
  );

  return enriched.filter((tenant) => matchesRegistryFilter(tenant, statusFilter));
}

function matchesRegistryFilter(
  tenant: TenantRegistryItem,
  filter: TenantRegistryStatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return tenant.status !== "ARCHIVED";
    case "active":
      return tenant.operationalPhase === "ACTIVE";
    case "onboarding":
      return tenant.operationalPhase === "ONBOARDING";
    case "suspended":
      return tenant.operationalPhase === "SUSPENDED";
    case "archived":
      return tenant.operationalPhase === "ARCHIVED";
    case "attention":
      return tenant.needsAttention && tenant.status !== "ARCHIVED";
    default:
      return true;
  }
}

export async function getTenantRegistryItemByKey(
  tenantKey: string,
): Promise<TenantRegistryItem | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantKey },
    select: registryTenantSelect,
  });
  if (!tenant) return null;

  const latestAuditByTenant = await getLatestAuditActivity([tenant.id]);
  return enrichTenantRow(tenant, latestAuditByTenant);
}

export async function getPlatformOpsOverview(): Promise<PlatformOpsOverview> {
  const tenants = await getTenantRegistryItems("all");
  const archivedCount = await prisma.tenant.count({ where: { status: "ARCHIVED" } });
  const allVisible = tenants;
  const archivedTenants = archivedCount;

  const totals = {
    all: allVisible.length + archivedTenants,
    active: allVisible.filter((t) => t.operationalPhase === "ACTIVE").length,
    onboarding: allVisible.filter((t) => t.operationalPhase === "ONBOARDING").length,
    suspended: allVisible.filter((t) => t.operationalPhase === "SUSPENDED").length,
    archived: archivedTenants,
    needsAttention: allVisible.filter((t) => t.needsAttention).length,
  };

  const attentionTenants = allVisible
    .filter((t) => t.needsAttention)
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      operationalPhase: t.operationalPhase,
      attentionItems: t.attentionItems,
    }));

  const lifecycleActions = Object.values(TENANT_LIFECYCLE_AUDIT_ACTIONS);
  const recentLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { moduleKey: "tenants", action: { in: lifecycleActions } },
        { moduleKey: "security" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      action: true,
      createdAt: true,
      tenantId: true,
      metadataJson: true,
      actorUser: {
        select: { firstName: true, lastName: true, email: true },
      },
      tenant: {
        select: { key: true, name: true },
      },
    },
  });

  const recentActivity = recentLogs.map((log) => ({
    id: log.id,
    action: log.action,
    createdAt: log.createdAt,
    tenantId: log.tenantId,
    tenantKey: log.tenant?.key ?? null,
    tenantName: log.tenant?.name ?? null,
    actorName: log.actorUser
      ? `${log.actorUser.firstName ?? ""} ${log.actorUser.lastName ?? ""}`.trim() || null
      : null,
    actorEmail: log.actorUser?.email ?? null,
    summary: formatAuditSummary(log.action, log.tenant?.name ?? null, log.metadataJson),
  }));

  return { totals, attentionTenants, recentActivity };
}

function formatAuditSummary(
  action: string,
  tenantName: string | null,
  metadataJson: unknown,
): string {
  const tenantLabel = tenantName ?? "Tenant";
  const metadata =
    metadataJson && typeof metadataJson === "object" && !Array.isArray(metadataJson)
      ? (metadataJson as Record<string, unknown>)
      : {};

  switch (action) {
    case TENANT_LIFECYCLE_AUDIT_ACTIONS.CREATED:
      return `${tenantLabel} erstellt`;
    case TENANT_LIFECYCLE_AUDIT_ACTIONS.ACTIVATED:
      return `${tenantLabel} aktiviert`;
    case TENANT_LIFECYCLE_AUDIT_ACTIONS.SUSPENDED:
      return `${tenantLabel} suspendiert`;
    case TENANT_LIFECYCLE_AUDIT_ACTIONS.REACTIVATED:
      return `${tenantLabel} reaktiviert`;
    case TENANT_LIFECYCLE_AUDIT_ACTIONS.ARCHIVED:
      return `${tenantLabel} archiviert`;
    case "impersonation_started":
      return "Impersonation gestartet";
    case "impersonation_stopped":
      return "Impersonation beendet";
    default:
      if (typeof metadata.reasonCode === "string") {
        return `${tenantLabel}: ${action} (${metadata.reasonCode})`;
      }
      return `${tenantLabel}: ${action}`;
  }
}

export async function getTenantLifecycleAudit(
  tenantId: string,
  limit = 8,
) {
  return prisma.auditLog.findMany({
    where: {
      tenantId,
      moduleKey: "tenants",
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      createdAt: true,
      beforeJson: true,
      afterJson: true,
      metadataJson: true,
      actorUser: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });
}

export async function getLatestSuspensionReason(
  tenantId: string,
): Promise<string | null> {
  const log = await prisma.auditLog.findFirst({
    where: {
      tenantId,
      moduleKey: "tenants",
      action: {
        in: [
          TENANT_LIFECYCLE_AUDIT_ACTIONS.SUSPENDED,
          TENANT_LIFECYCLE_AUDIT_ACTIONS.ARCHIVED,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    select: { metadataJson: true, action: true },
  });

  if (!log?.metadataJson || typeof log.metadataJson !== "object" || Array.isArray(log.metadataJson)) {
    return null;
  }

  const reason = (log.metadataJson as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

export async function getTenantAdministrators(tenantId: string, tenantKey: string) {
  const roleKey = getTenantClubAdminRoleKey(tenantKey);
  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId,
      isActive: true,
      user: {
        isActive: true,
        userRoles: {
          some: {
            tenantId,
            role: { key: roleKey, isArchived: false },
          },
        },
      },
    },
    select: {
      joinedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((membership) => ({
    id: membership.user.id,
    email: membership.user.email,
    name:
      `${membership.user.firstName ?? ""} ${membership.user.lastName ?? ""}`.trim() ||
      membership.user.email,
    joinedAt: membership.joinedAt,
  }));
}
