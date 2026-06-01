import { DEFAULT_TENANT_KEY, getActiveTenantByKey } from "@/lib/tenants/queries";

export async function requireTenant(key = DEFAULT_TENANT_KEY) {
  const tenant = await getActiveTenantByKey(key);

  if (!tenant) {
    throw new Error(`Active tenant not found: ${key}`);
  }

  return tenant;
}

export type RequiredTenant = Awaited<ReturnType<typeof requireTenant>>;
