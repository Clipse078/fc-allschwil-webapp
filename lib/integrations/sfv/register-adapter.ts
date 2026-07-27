/**
 * lib/integrations/sfv/register-adapter.ts
 *
 * Lazy registration guard for the SFV provider adapter.
 *
 * Ensures the SFV adapter is registered in the canonical provider registry
 * exactly once per process lifetime. Safe to call multiple times — subsequent
 * calls are no-ops.
 *
 * Usage:
 *   import { ensureSfvAdapterRegistered } from "@/lib/integrations/sfv/register-adapter";
 *   ensureSfvAdapterRegistered();  // top of any API route that uses provider mapping
 *
 * Architecture invariant:
 *   Only this module imports from sfv/provider-adapter. All other provider
 *   mapping code is provider-neutral.
 */

import { registerSfvAdapter } from "./provider-adapter";
import { getProviderAdapter } from "@/lib/provider-mapping/provider-registry";

const SFV_KEY = "SFV";

/**
 * Registers the SFV adapter if not already registered.
 * Idempotent — safe to call on every request.
 */
export function ensureSfvAdapterRegistered(): void {
  if (!getProviderAdapter(SFV_KEY)) {
    registerSfvAdapter();
  }
}
