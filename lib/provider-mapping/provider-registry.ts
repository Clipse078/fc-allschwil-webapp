/**
 * lib/provider-mapping/provider-registry.ts
 *
 * Provider adapter registry.
 *
 * Maintains the set of registered provider adapters. Canonical services
 * resolve adapters from this registry by provider key at runtime.
 *
 * Architecture invariants:
 *   - Only one adapter per provider key is allowed.
 *   - SFV is registered at startup in lib/integrations/sfv/register-adapter.ts.
 *   - Canonical services never import SFV code directly.
 */

import type { IProviderAdapter } from "./types";

// ── Registry singleton ────────────────────────────────────────────────────────

const registry = new Map<string, IProviderAdapter>();

/**
 * Registers a provider adapter.
 * Must be called at application startup before any mapping service is invoked.
 *
 * @throws if an adapter for this provider key is already registered.
 */
export function registerProviderAdapter(adapter: IProviderAdapter): void {
  if (registry.has(adapter.providerKey)) {
    throw new Error(
      `Provider adapter for "${adapter.providerKey}" is already registered.`,
    );
  }
  registry.set(adapter.providerKey, adapter);
}

/**
 * Returns the adapter for the given provider key.
 * Returns undefined when no adapter is registered for that key.
 */
export function getProviderAdapter(providerKey: string): IProviderAdapter | undefined {
  return registry.get(providerKey);
}

/**
 * Returns all registered provider keys.
 */
export function getRegisteredProviders(): string[] {
  return [...registry.keys()];
}

/**
 * Clears all registered adapters.
 * Only for test isolation — do not call in production code.
 */
export function _clearRegistryForTests(): void {
  registry.clear();
}
