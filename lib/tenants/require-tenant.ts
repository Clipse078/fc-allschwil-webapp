import { DEFAULT_TENANT_SLUG, getActiveTenantBySlug } from "@/lib/tenants/queries";

export async function requireTenant(slug = DEFAULT_TENANT_SLUG) {
  const tenant = await getActiveTenantBySlug(slug);

  if (!tenant) {
    throw new Error(`Active tenant not found: ${slug}`);
  }

  return tenant;
}

export type RequiredTenant = Awaited<ReturnType<typeof requireTenant>>;
