import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import AdminShellChrome from "@/components/admin/layout/AdminShellChrome";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AdminShellChrome
      firstName={session.user.firstName}
      lastName={session.user.lastName}
      email={session.user.email}
      permissionKeys={session.user.permissionKeys}
      isImpersonating={session.user.isImpersonating ?? false}
      actorName={session.user.actorName ?? null}
      actorEmail={session.user.actorEmail ?? null}
    >
      {children}
    </AdminShellChrome>
  );
}
