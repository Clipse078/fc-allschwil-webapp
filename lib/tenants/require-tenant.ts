import { DEFAULT_TENANT_KEY, getActiveTenantByKey } from "@/lib/tenants/queries";

export async function requireTenant(key = DEFAULT_TENANT_KEY) {
  let tenant: Awaited<ReturnType<typeof getActiveTenantByKey>>;

  try {
    tenant = await getActiveTenantByKey(key);
  } catch (err) {
    // Surface DB-level errors (e.g. table not yet migrated) as a clear message
    // so callers receive a meaningful 500 rather than an opaque Prisma stack trace.
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Tenant lookup failed for "${key}": ${detail}`);
  }

  if (!tenant) {
    throw new Error(`Active tenant not found: "${key}". Run prisma migrate deploy and db seed.`);
  }

  return tenant;
}

export type RequiredTenant = Awaited<ReturnType<typeof requireTenant>>;
