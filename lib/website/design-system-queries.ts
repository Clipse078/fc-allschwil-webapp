/**
 * lib/website/design-system-queries.ts
 *
 * Design System Manager — CMS V4
 *
 * Admin-side CRUD for tenant design system configuration.
 * All public reads use resolveDesignSystem() from design-system-types.ts.
 */

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { resolveTenantBranding } from "@/lib/tenant-runtime/branding";
import { resolveDesignSystem, type TenantDesignSystem, type ResolvedDesignSystem } from "./design-system-types";

// ─────────────────────────────────────────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────────────────────────────────────────

const designSystemSelect = {
  id: true,
  key: true,
  name: true,
  primaryColor: true,
  secondaryColor: true,
  logoUrl: true,
  websiteDesignSystem: true,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Readers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the resolved design system for a tenant, merging stored config with
 * DEFAULT_DESIGN_SYSTEM and branding colours (primary/secondary).
 *
 * Safe to call from public endpoints and admin surfaces alike.
 */
export async function getResolvedDesignSystem(tenantId: string): Promise<ResolvedDesignSystem> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: designSystemSelect,
  });

  if (!tenant) {
    return resolveDesignSystem(null);
  }

  const branding = resolveTenantBranding(tenant);

  return resolveDesignSystem(tenant.websiteDesignSystem, {
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
  });
}

/**
 * Returns the raw stored design system JSON for a tenant (may be null).
 * Used by the admin editor to populate form values.
 */
export async function getRawDesignSystem(
  tenantId: string,
): Promise<TenantDesignSystem | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { websiteDesignSystem: true },
  });

  if (!tenant?.websiteDesignSystem) return null;
  return tenant.websiteDesignSystem as TenantDesignSystem;
}

/**
 * Returns the resolved design system for a tenant identified by slug.
 * Used by the public API endpoint.
 */
export async function getResolvedDesignSystemByKey(tenantKey: string): Promise<ResolvedDesignSystem> {
  const tenant = await prisma.tenant.findFirst({
    where: { key: tenantKey, status: "ACTIVE" },
    select: designSystemSelect,
  });

  if (!tenant) {
    return resolveDesignSystem(null);
  }

  const branding = resolveTenantBranding(tenant);

  return resolveDesignSystem(tenant.websiteDesignSystem, {
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Writers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves the full design system configuration for a tenant.
 * The stored value is the raw user-configured overrides (not resolved).
 */
export async function saveDesignSystem(
  tenantId: string,
  designSystem: TenantDesignSystem,
): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { websiteDesignSystem: designSystem as object },
  });
}

/**
 * Resets the design system to platform defaults by clearing the stored JSON.
 */
export async function resetDesignSystem(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { websiteDesignSystem: Prisma.DbNull },
  });
}
