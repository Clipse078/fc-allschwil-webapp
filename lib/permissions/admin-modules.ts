/**
 * Adapter: exposes ADMIN_MODULES derived from the canonical MODULE_DEFINITIONS
 * in lib/nav/nav-config.ts. Kept for backward compatibility.
 * Prefer importing ModuleDefinition / MODULE_DEFINITIONS from nav-config directly.
 */

import { type PermissionKey } from "@/lib/permissions/permissions";
import { MODULE_DEFINITIONS } from "@/lib/nav/nav-config";

export type AdminModuleDefinition = {
  key: string;
  title: string;
  description: string;
  href: string;
  requiredPermissions?: PermissionKey[];
};

/** Full list of admin module definitions (title/description/permissions). */
export const ADMIN_MODULES: AdminModuleDefinition[] = MODULE_DEFINITIONS.map((m) => ({
  key: m.key,
  title: m.label,
  description: m.description,
  href: m.href,
  requiredPermissions: m.permissionKeys,
}));
