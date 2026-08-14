"use client";

/**
 * ScopedRoleManagementControl — USER-ADMIN-02
 *
 * Replaces the read-only ScopedRolesSummary on the user detail page.
 * Allows admins to assign and remove OrgUnit-scoped role assignments
 * for a specific user, using canonical ORG-ACCESS mechanisms.
 *
 * Canonical rules:
 *   - Only TENANT-scoped roles (not Club Admin) can be used here.
 *   - OrgUnit must belong to the tenant.
 *   - Multiple simultaneous assignments (multi-role / multi-OrgUnit) supported.
 *   - Removing one assignment never affects others.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Shield, Trash2, X } from "lucide-react";
import Link from "next/link";

export type ScopedRoleItem = {
  id: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  orgUnitId: string;
  orgUnitName: string;
  scopeMode: "THIS_ORG_UNIT" | "THIS_ORG_UNIT_AND_DESCENDANTS";
};

type RoleOption = { id: string; name: string };
type OrgUnitOption = { id: string; name: string };

type Props = {
  userId: string;
  assignments: ScopedRoleItem[];
  availableRoles: RoleOption[];
  availableOrgUnits: OrgUnitOption[];
  canManage: boolean;
};

const SCOPE_SUFFIX: Record<string, string | null> = {
  THIS_ORG_UNIT: null,
  THIS_ORG_UNIT_AND_DESCENDANTS: "+ Unterbereiche",
};

type ScopeMode = "THIS_ORG_UNIT" | "THIS_ORG_UNIT_AND_DESCENDANTS";

export default function ScopedRoleManagementControl({
  userId,
  assignments,
  availableRoles,
  availableOrgUnits,
  canManage,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Add form state
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState("");
  const [selectedScopeMode, setSelectedScopeMode] = useState<ScopeMode>("THIS_ORG_UNIT");

  function handleRemove(userRoleId: string) {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/scoped-roles`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userRoleId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Ein Fehler ist aufgetreten.");
          return;
        }
        router.refresh();
      } catch {
        setError("Netzwerkfehler. Bitte versuche es erneut.");
      }
    });
  }

  function handleAdd() {
    if (!selectedRoleId || !selectedOrgUnitId) {
      setError("Bitte Rolle und Bereich auswählen.");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/scoped-roles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleId: selectedRoleId,
            orgUnitId: selectedOrgUnitId,
            scopeMode: selectedScopeMode,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Ein Fehler ist aufgetreten.");
          return;
        }
        setShowForm(false);
        setSelectedRoleId("");
        setSelectedOrgUnitId("");
        setSelectedScopeMode("THIS_ORG_UNIT");
        router.refresh();
      } catch {
        setError("Netzwerkfehler. Bitte versuche es erneut.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Existing assignments */}
      {assignments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Keine Bereichszuständigkeiten zugewiesen.
        </p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5"
            >
              <Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {a.roleName}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                    <Building2 className="h-3 w-3" />
                    <Link
                      href={`/dashboard/org-units/${a.orgUnitId}`}
                      className="hover:underline hover:text-[var(--foreground)]"
                    >
                      {a.orgUnitName}
                    </Link>
                  </span>
                  {SCOPE_SUFFIX[a.scopeMode] ? (
                    <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                      {SCOPE_SUFFIX[a.scopeMode]}
                    </span>
                  ) : null}
                </div>
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  disabled={isPending}
                  title="Zuweisung entfernen"
                  className="flex-shrink-0 rounded p-1 text-[var(--muted)] hover:bg-red-50 hover:text-red-600 disabled:opacity-40 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* Error message */}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      {/* Add form */}
      {canManage ? (
        showForm ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Neue Bereichszuständigkeit
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Role select */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted)]">Rolle</label>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30"
              >
                <option value="">Rolle auswählen…</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* OrgUnit select */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted)]">Bereich</label>
              <select
                value={selectedOrgUnitId}
                onChange={(e) => setSelectedOrgUnitId(e.target.value)}
                className="w-full h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30"
              >
                <option value="">Bereich auswählen…</option>
                {availableOrgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope mode */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted)]">Geltungsbereich</label>
              <select
                value={selectedScopeMode}
                onChange={(e) => setSelectedScopeMode(e.target.value as ScopeMode)}
                className="w-full h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30"
              >
                <option value="THIS_ORG_UNIT">Nur dieser Bereich</option>
                <option value="THIS_ORG_UNIT_AND_DESCENDANTS">
                  Dieser Bereich + Unterbereiche
                </option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={isPending || !selectedRoleId || !selectedOrgUnitId}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                {isPending ? "Hinzufügen…" : "Hinzufügen"}
              </button>
            </div>
          </div>
        ) : (
          availableRoles.length > 0 && availableOrgUnits.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Bereichszuständigkeit hinzufügen
            </button>
          ) : null
        )
      ) : null}
    </div>
  );
}
