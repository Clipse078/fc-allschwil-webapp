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
  accessState: string;
  invitedAt?: string | Date | null;
  inviteAcceptedAt?: string | Date | null;
  passwordResetSentAt?: string | Date | null;
  lastLoginAt?: string | Date | null;
  roles: string[];
};

type UsersTableProps = {
  currentUserId: string;
  initialUsers: UserItem[];
};

function getAccessStateLabel(accessState: string) {
  switch (accessState) {
    case "PENDING_INVITE":
      return "Wartet auf Einladung";
    case "INVITED":
      return "Eingeladen";
    case "ACTIVE":
      return "Aktiviert";
    case "SUSPENDED":
      return "Gesperrt";
    default:
      return accessState;
  }
}

function getAccessStateTone(accessState: string): "success" | "warning" | "muted" {
  switch (accessState) {
    case "ACTIVE":
      return "success";
    case "INVITED":
      return "warning";
    case "PENDING_INVITE":
    case "SUSPENDED":
    default:
      return "muted";
  }
}

function getActivityHint(user: UserItem) {
  if (user.lastLoginAt) {
    return "Letzter Login vorhanden";
  }

  if (user.inviteAcceptedAt) {
    return "Einladung angenommen";
  }

  if (user.passwordResetSentAt) {
    return "Reset-Link gesendet";
  }

  if (user.invitedAt) {
    return "Einladung gesendet";
  }

  return "Noch kein Zugang aktiviert";
}

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
              <AdminStatusPill
                label={getAccessStateLabel(user.accessState)}
                tone={getAccessStateTone(user.accessState)}
              />
              <span className="text-xs text-slate-500">{getActivityHint(user)}</span>
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