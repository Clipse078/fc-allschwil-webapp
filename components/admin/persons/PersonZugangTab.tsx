"use client";

/**
 * PERSON-UX-01 — Zugang tab.
 *
 * Wraps the existing PersonAccessRolesCard for the workspace tab layout.
 * No new permission model is introduced; all logic remains in PersonAccessRolesCard.
 *
 * Security principle: "One canonical Person, separately authorized information domains."
 * Generic people.view access does NOT automatically grant access to medical, financial,
 * or private document data. This tab only shows what was previously visible in the
 * sidebar (User link + tenant role assignment), requiring roles.view / roles.assign.
 */

import { KeyRound, Info } from "lucide-react";
import PersonAccessRolesCard from "./PersonAccessRolesCard";
import type { PersonAccessRole, PersonAccessLinkedUser } from "./PersonAccessRolesCard";

type PersonZugangTabProps = {
  personId: string;
  accessRolesCard: {
    linkedUser: PersonAccessLinkedUser | null;
    isActiveTenantMember: boolean;
    roles: PersonAccessRole[];
    assignedRoleIds: string[];
    canAssign: boolean;
  } | null;
};

export default function PersonZugangTab({ personId, accessRolesCard }: PersonZugangTabProps) {
  if (!accessRolesCard) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
        <p className="text-sm text-[var(--muted)]">
          Keine Berechtigung zum Anzeigen von Zugangsinformationen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Account & Rollen ─────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          Benutzerkonto & Mandantenrollen
        </h3>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <PersonAccessRolesCard
            personId={personId}
            linkedUser={accessRolesCard.linkedUser}
            isActiveTenantMember={accessRolesCard.isActiveTenantMember}
            roles={accessRolesCard.roles}
            assignedRoleIds={accessRolesCard.assignedRoleIds}
            canAssign={accessRolesCard.canAssign}
          />
        </div>
      </div>

      {/* ── Sicherheitshinweis ───────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
        <div className="text-xs text-[var(--muted)] leading-relaxed space-y-1">
          <p className="font-medium text-[var(--text-2)]">Sicherheitsprinzip: separat autorisierte Informationsdomänen</p>
          <p>
            Allgemeiner Personenzugriff (people.view) gewährt keinen automatischen Zugang zu
            medizinischen Daten, privaten Dokumenten oder Finanzdaten dieser Person.
            Diese Domänen erfordern dedizierte Berechtigungen, die in späteren Modulen eingeführt werden.
          </p>
        </div>
      </div>
    </div>
  );
}
