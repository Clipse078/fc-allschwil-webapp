"use client";

import { useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type RoleItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

type UserRolesFormProps = {
  userId: string;
  initialRoles: RoleItem[];
  initialSelectedRoleIds: string[];
};

export default function UserRolesForm({
  userId,
  initialRoles,
  initialSelectedRoleIds,
}: UserRolesFormProps) {
  const [roles] = useState<RoleItem[]>(initialRoles);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(initialSelectedRoleIds);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId]
    );
  }

  async function handleSave() {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/users/" + userId + "/roles", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleIds: selectedRoleIds,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Rollen konnten nicht gespeichert werden.");
      }

      setSelectedRoleIds(Array.isArray(data?.roleIds) ? data.roleIds : selectedRoleIds);
      setMessage("Rollen erfolgreich gespeichert.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="fca-subheading">Rollen</h3>
          <p className="mt-3 text-sm text-slate-600">
            Weise diesem Benutzer die passenden Rollen zu.
          </p>
        </div>

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        {message ? (
          <div className="fca-status-box fca-status-box-success">{message}</div>
        ) : null}

        {roles.length === 0 ? (
          <div className="fca-status-box fca-status-box-muted">
            Keine Rollen gefunden.
          </div>
        ) : (
          <div className="grid gap-3">
            {roles.map((role) => (
              <label
                key={role.id}
                className="fca-section-card flex items-start gap-3 px-4 py-4"
              >
                <input
                  type="checkbox"
                  checked={selectedRoleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="mt-1 fca-toggle-checkbox"
                />

                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {role.name}
                  </div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {role.key}
                  </div>
                  {role.description ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {role.description}
                    </p>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={submitting || roles.length === 0}
          className="fca-button-primary"
        >
          {submitting ? "Speichern..." : "Rollen speichern"}
        </button>
      </div>
    </AdminSurfaceCard>
  );
}
