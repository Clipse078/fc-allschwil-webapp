/**
 * Adapter: exposes a flat AdminNavItem list derived from the canonical NAV_SECTIONS
 * in lib/nav/nav-config.ts. Kept for backward compatibility with any callers that
 * expect the old flat API. Prefer importing from nav-config directly for new code.
 */

import { type PermissionKey } from "@/lib/permissions/permissions";
import {
  NAV_SECTIONS,
  getVisibleNavSections,
  flattenNavSections,
} from "@/lib/nav/nav-config";

export type AdminNavItem = {
  label: string;
  href: string;
  permissionKeys?: PermissionKey[];
};

/** Ordered flat list of all nav items (parents + children). */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = flattenNavSections(NAV_SECTIONS);

/** Returns nav items visible to the given permission keys (flat list). */
export function getVisibleAdminNav(permissionKeys: PermissionKey[]): AdminNavItem[] {
  return flattenNavSections(getVisibleNavSections(permissionKeys));
}
