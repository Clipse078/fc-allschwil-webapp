import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import AdminHeaderNotificationBell from "@/components/admin/layout/AdminHeaderNotificationBell";
import { getAdminNavWithMeta } from "@/lib/navigation/get-admin-nav-with-meta";
import { getMyTaskCount } from "@/lib/tasks/get-my-task-count";
import { getMyTaskPreview } from "@/lib/tasks/get-my-task-preview";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect("/login");

  const navItems = await getAdminNavWithMeta();
  const taskCount = await getMyTaskCount();
  const taskPreview = await getMyTaskPreview(5);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        navItems={navItems}
        firstName={session.user.firstName}
        lastName={session.user.lastName}
        currentSeasonLabel="2025/2026"
      />

      <main className="flex-1">
        <div className="flex justify-end p-4">
          <AdminHeaderNotificationBell count={taskCount} tasks={taskPreview} />
        </div>

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
