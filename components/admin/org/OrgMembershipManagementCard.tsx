"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, UserPlus, Users } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import OrgMembershipPicker from "@/components/admin/org/OrgMembershipPicker";

type MembershipUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type MembershipPerson = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
};

export type Membership = {
  id: string;
  userId: string | null;
  personId: string | null;
  roleKey: string | null;
  isPrimary: boolean;
  status: string;
  user: MembershipUser | null;
  person: MembershipPerson | null;
};

type OrgMembershipManagementCardProps = {
  orgUnitId: string;
  initialMemberships: Membership[];
};

function getMemberTitle(m: Membership): string {
  if (m.user) return `${m.user.firstName} ${m.user.lastName}`;
  if (m.person) {
    return (
      m.person.displayName || `${m.person.firstName} ${m.person.lastName}`
    );
  }
  if (m.userId) return `User: ${m.userId.substring(0, 8)}…`;
  if (m.personId) return `Person: ${m.personId.substring(0, 8)}…`;
  return "Nicht zugewiesen";
}

function getMemberSubtitle(m: Membership): string | undefined {
  if (m.user?.email) return m.user.email;
  if (m.person?.email) return m.person.email;
  return undefined;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  PENDING: "Ausstehend",
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function getStatusTone(
  status: string
): "success" | "warning" | "muted" | "default" {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warning";
  return "muted";
}

export default function OrgMembershipManagementCard({
  orgUnitId,
  initialMemberships,
}: OrgMembershipManagementCardProps) {
  const router = useRouter();
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const existingMemberUserIds = initialMemberships
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);

  const existingMemberPersonIds = initialMemberships
    .map((m) => m.personId)
    .filter((id): id is string => id !== null);

  function handleAdded() {
    setAddPanelOpen(false);
    router.refresh();
  }

  async function handleRemove(m: Membership) {
    const name = getMemberTitle(m);
    const confirmed = window.confirm(
      `Mitgliedschaft von „${name}" wirklich entfernen?`
    );
    if (!confirmed) return;

    setRemovingId(m.id);
    setRemoveError(null);

    try {
      const res = await fetch(
        `/api/org-units/${orgUnitId}/memberships/${m.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemoveError(
          data?.error ?? "Mitgliedschaft konnte nicht entfernt werden."
        );
        return;
      }
      router.refresh();
    } catch {
      setRemoveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="sce-detail-section">
      {/* Header */}
      <div className="sce-detail-section-header">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--muted)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Mitglieder
          </p>
          <span className="sce-count-badge">{initialMemberships.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setAddPanelOpen((v) => !v)}
          className="fca-button-primary"
        >
          {addPanelOpen ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Schließen
            </>
          ) : (
            <>
              <UserPlus className="h-3.5 w-3.5" />
              Mitglied hinzufügen
            </>
          )}
        </button>
      </div>

      {/* Add panel */}
      {addPanelOpen ? (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] p-5">
          <OrgMembershipPicker
            orgUnitId={orgUnitId}
            existingMemberUserIds={existingMemberUserIds}
            existingMemberPersonIds={existingMemberPersonIds}
            onAdded={handleAdded}
          />
        </div>
      ) : null}

      {/* Remove error */}
      {removeError ? (
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {removeError}
        </div>
      ) : null}

      {/* Member list */}
      {initialMemberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Users className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm text-[var(--muted)]">
            Noch keine Mitglieder dieser Einheit.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {initialMemberships.map((m) => {
            const title = getMemberTitle(m);
            const subtitle = getMemberSubtitle(m);

            return (
              <div
                key={m.id}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <AdminAvatar name={title} size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                    {title}
                  </p>
                  {subtitle ? (
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                      {subtitle}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  <AdminStatusPill
                    label={getStatusLabel(m.status)}
                    tone={getStatusTone(m.status)}
                  />
                  {m.roleKey ? (
                    <span className="sce-role-badge sce-role-badge-member">
                      {m.roleKey}
                    </span>
                  ) : null}
                  {m.isPrimary ? (
                    <span className="sce-role-badge"
                      style={{
                        background: "rgba(11,74,162,0.10)",
                        color: "var(--blue)",
                        border: "1px solid rgba(11,74,162,0.20)",
                      }}
                    >
                      Primär
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleRemove(m)}
                    disabled={removingId === m.id}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {removingId === m.id ? "Entfernen…" : "Entfernen"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
