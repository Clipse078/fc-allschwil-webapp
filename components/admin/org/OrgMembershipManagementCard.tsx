"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
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
        setRemoveError(data?.error ?? "Mitgliedschaft konnte nicht entfernt werden.");
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
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#0b4aa2]" />
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Mitglieder
          </h3>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {initialMemberships.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAddPanelOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0b4aa2] px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#08357a]"
        >
          {addPanelOpen ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Schließen
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Mitglied hinzufügen
            </>
          )}
        </button>
      </div>

      {/* Add panel */}
      {addPanelOpen ? (
        <div className="mb-5 rounded-[20px] border border-slate-200 bg-slate-50 p-5">
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
        <div className="mb-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {removeError}
        </div>
      ) : null}

      {/* Member list */}
      {initialMemberships.length === 0 ? (
        <p className="text-[12px] italic text-slate-400">
          Noch keine Mitglieder dieser Einheit.
        </p>
      ) : (
        <div className="space-y-3">
          {initialMemberships.map((m) => {
            const title = getMemberTitle(m);
            const subtitle = getMemberSubtitle(m);

            return (
              <AdminListItem
                key={m.id}
                avatar={<AdminAvatar name={title} size="sm" />}
                title={title}
                subtitle={subtitle}
                meta={
                  <>
                    <AdminStatusPill
                      label={getStatusLabel(m.status)}
                      tone={getStatusTone(m.status)}
                    />
                    {m.roleKey ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {m.roleKey}
                      </span>
                    ) : null}
                    {m.isPrimary ? (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-blue-700">
                        Primär
                      </span>
                    ) : null}
                  </>
                }
                actions={
                  <button
                    type="button"
                    onClick={() => handleRemove(m)}
                    disabled={removingId === m.id}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {removingId === m.id ? "Entfernen…" : "Entfernen"}
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
