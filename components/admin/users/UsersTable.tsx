"use client";

import Link from "next/link";
import ImpersonateButton from "@/components/admin/users/ImpersonateButton";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type UserItem = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: string[];
};

type UsersTableProps = {
  currentUserId: string;
  initialUsers: UserItem[];
};

export default function UsersTable({
  currentUserId,
  initialUsers,
}: UsersTableProps) {
  if (initialUsers.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <p className="text-sm text-slate-600">Noch keine Benutzer gefunden.</p>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {initialUsers.map((user) => (
        <AdminListItem
          key={user.id}
          avatar={<AdminAvatar name={user.name} size="md" />}
          title={user.name}
          subtitle={user.email}
          meta={
            <>
              <AdminStatusPill
                label={user.isActive ? "Aktiv" : "Inaktiv"}
                tone={user.isActive ? "success" : "muted"}
              />
              {user.roles.length > 0 ? (
                user.roles.map((role) => (
                  <span key={role} className="fca-pill">
                    {role}
                  </span>
                ))
              ) : (
                <span className="fca-pill">Keine Rolle</span>
              )}
            </>
          }
          actions={
            <>
              <Link
                href={`/dashboard/users/${user.id}`}
                className="fca-button-primary"
              >
                Bearbeiten
              </Link>

              {user.id === currentUserId ? (
                <span className="text-xs font-medium text-slate-400">
                  Aktueller Benutzer
                </span>
              ) : (
                <ImpersonateButton userId={user.id} />
              )}
            </>
          }
        />
      ))}
    </div>
  );
}
