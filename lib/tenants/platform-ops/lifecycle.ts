import type { Prisma, PrismaClient, TenantStatus } from "@prisma/client";
import { writeAuditRecord } from "@/lib/audit/audit-record";
import {
  TENANT_LIFECYCLE_AUDIT_ACTIONS,
  type TenantLifecycleAction,
} from "@/lib/tenants/platform-ops/types";

type LifecycleClient = Pick<
  PrismaClient,
  "tenant" | "auditLog" | "$transaction"
>;

export class TenantLifecycleError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "TenantLifecycleError";
    this.code = code;
    this.status = status;
  }
}

type TenantLifecycleRow = {
  id: string;
  key: string;
  name: string;
  status: TenantStatus;
};

type TransitionContext = {
  actorUserId: string;
  reason?: string | null;
};

type TransitionResult = {
  tenant: TenantLifecycleRow;
  previousStatus: TenantStatus;
  newStatus: TenantStatus;
  action: TenantLifecycleAction;
};

function normalizeReason(reason: string | null | undefined, required: boolean): string | null {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) {
    if (required) {
      throw new TenantLifecycleError(
        "REASON_REQUIRED",
        "Ein Grund ist für diese Aktion erforderlich.",
      );
    }
    return null;
  }
  if (trimmed.length > 500) {
    throw new TenantLifecycleError(
      "REASON_TOO_LONG",
      "Der Grund darf maximal 500 Zeichen lang sein.",
    );
  }
  return trimmed;
}

function resolveTransition(
  current: TenantStatus,
  action: TenantLifecycleAction,
): { nextStatus: TenantStatus; auditAction: string; reasonRequired: boolean } {
  switch (action) {
    case "activate":
      if (current === "ACTIVE") {
        throw new TenantLifecycleError(
          "INVALID_TRANSITION",
          "Tenant ist bereits aktiv.",
        );
      }
      if (current === "ARCHIVED") {
        throw new TenantLifecycleError(
          "INVALID_TRANSITION",
          "Archivierte Tenants können nicht aktiviert werden.",
        );
      }
      return {
        nextStatus: "ACTIVE",
        auditAction: TENANT_LIFECYCLE_AUDIT_ACTIONS.ACTIVATED,
        reasonRequired: false,
      };
    case "reactivate":
      if (current !== "INACTIVE") {
        throw new TenantLifecycleError(
          "INVALID_TRANSITION",
          "Nur suspendierte Tenants können reaktiviert werden.",
        );
      }
      return {
        nextStatus: "ACTIVE",
        auditAction: TENANT_LIFECYCLE_AUDIT_ACTIONS.REACTIVATED,
        reasonRequired: false,
      };
    case "suspend":
      if (current !== "ACTIVE") {
        throw new TenantLifecycleError(
          "INVALID_TRANSITION",
          "Nur aktive Tenants können suspendiert werden.",
        );
      }
      return {
        nextStatus: "INACTIVE",
        auditAction: TENANT_LIFECYCLE_AUDIT_ACTIONS.SUSPENDED,
        reasonRequired: true,
      };
    case "archive":
      if (current === "ARCHIVED") {
        throw new TenantLifecycleError(
          "INVALID_TRANSITION",
          "Tenant ist bereits archiviert.",
        );
      }
      return {
        nextStatus: "ARCHIVED",
        auditAction: TENANT_LIFECYCLE_AUDIT_ACTIONS.ARCHIVED,
        reasonRequired: true,
      };
    default:
      throw new TenantLifecycleError("INVALID_ACTION", "Unbekannte Lifecycle-Aktion.");
  }
}

async function assertNotLastActiveTenant(
  client: LifecycleClient,
  tenantId: string,
  action: TenantLifecycleAction,
): Promise<void> {
  if (action !== "suspend" && action !== "archive") return;

  const activeCount = await client.tenant.count({
    where: { status: "ACTIVE" },
  });
  if (activeCount <= 1) {
    const tenant = await client.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (tenant?.status === "ACTIVE") {
      throw new TenantLifecycleError(
        "LAST_ACTIVE_TENANT",
        "Der letzte aktive Tenant kann nicht suspendiert oder archiviert werden.",
        409,
      );
    }
  }
}

export async function applyTenantLifecycleTransition(
  client: LifecycleClient,
  tenant: TenantLifecycleRow,
  action: TenantLifecycleAction,
  context: TransitionContext,
): Promise<TransitionResult> {
  const { nextStatus, auditAction, reasonRequired } = resolveTransition(
    tenant.status,
    action,
  );
  const reason = normalizeReason(context.reason, reasonRequired);

  await assertNotLastActiveTenant(client, tenant.id, action);

  const updated = await client.$transaction(async (tx) => {
    const row = await tx.tenant.update({
      where: { id: tenant.id },
      data: { status: nextStatus },
      select: { id: true, key: true, name: true, status: true },
    });

    await writeAuditRecord(tx, {
      actorUserId: context.actorUserId,
      tenantId: tenant.id,
      moduleKey: "tenants",
      entityType: "Tenant",
      entityId: tenant.id,
      action: auditAction,
      beforeJson: { status: tenant.status },
      afterJson: { status: nextStatus },
      metadataJson: {
        tenantKey: tenant.key,
        tenantName: tenant.name,
        action,
        ...(reason ? { reason } : {}),
      },
    });

    return row;
  });

  return {
    tenant: updated,
    previousStatus: tenant.status,
    newStatus: nextStatus,
    action,
  };
}

export async function auditTenantCreated(
  client: Pick<Prisma.TransactionClient, "auditLog">,
  input: {
    actorUserId: string;
    tenant: TenantLifecycleRow;
  },
): Promise<void> {
  await writeAuditRecord(client, {
    actorUserId: input.actorUserId,
    tenantId: input.tenant.id,
    moduleKey: "tenants",
    entityType: "Tenant",
    entityId: input.tenant.id,
    action: TENANT_LIFECYCLE_AUDIT_ACTIONS.CREATED,
    afterJson: {
      status: input.tenant.status,
      key: input.tenant.key,
      name: input.tenant.name,
    },
    metadataJson: {
      tenantKey: input.tenant.key,
      tenantName: input.tenant.name,
    },
  });
}

export async function auditTenantArchived(
  client: Pick<Prisma.TransactionClient, "auditLog">,
  input: {
    actorUserId: string;
    tenant: TenantLifecycleRow;
    reason?: string | null;
  },
): Promise<void> {
  await writeAuditRecord(client, {
    actorUserId: input.actorUserId,
    tenantId: input.tenant.id,
    moduleKey: "tenants",
    entityType: "Tenant",
    entityId: input.tenant.id,
    action: TENANT_LIFECYCLE_AUDIT_ACTIONS.ARCHIVED,
    beforeJson: { status: input.tenant.status },
    afterJson: { status: "ARCHIVED" },
    metadataJson: {
      tenantKey: input.tenant.key,
      tenantName: input.tenant.name,
      action: "archive",
      ...(input.reason ? { reason: input.reason } : {}),
    },
  });
}
