import { auth } from "@/auth";
import {
  getVisibleAdminNav,
  type AdminNavItem,
} from "@/lib/permissions/get-visible-admin-nav";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { getMyTaskCount } from "@/lib/tasks/get-my-task-count";

export type AdminNavItemWithMeta = AdminNavItem & {
  badgeCount?: number;
  highlight?: boolean;
};

export async function getAdminNavWithMeta(): Promise<AdminNavItemWithMeta[]> {
  const session = await auth();

  if (!session?.user) return [];

  const baseNav = getVisibleAdminNav(
    session.user.permissionKeys as PermissionKey[],
  );

  const taskCount = await getMyTaskCount();

  return baseNav.map((item) => {
    if (item.href === "/dashboard/tasks") {
      return {
        ...item,
        badgeCount: taskCount,
        highlight: true,
      };
    }

    return item;
  });
}
