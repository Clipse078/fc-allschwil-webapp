"use client";

import { useMemo, useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type RoleItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  canAccessVereinsleitung: boolean;
  canAttendVereinsleitungMeetings: boolean;
  updatedAt: string | Date;
};

type RoleManagementCardProps = {
  initialRoles: RoleItem[];
};

type EditableRoleState = {
  id: string;
  key: string;
  name: string;
  description: string;
  canAccessVereinsleitung: boolean;
  canAttendVereinsleitungMeetings: boolean;
  updatedAt: string | Date;
};

function formatDateTime(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RoleManagementCard({
  initialRoles,
}: RoleManagementCardProps) {
  const [roles, setRoles] = useState<EditableRoleState[]>(
    initialRoles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description ?? "",
      canAccessVereinsleitung: role.canAccessVereinsleitung,
      canAttendVereinsleitungMeetings: role.canAttendVereinsleitungMeetings,
      updatedAt: role.updatedAt,
    })),
  );
  const [search, setSearch] = useState("");
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return roles;
    }

    return roles.filter((role) => {
      return (
        role.name.toLowerCase().includes(term) ||
        role.key.toLowerCase().includes(term) ||
        role.description.toLowerCase().includes(term)
      );
    });
  }, [roles, search]);

  function updateRoleField<K extends keyof EditableRoleState>(
    roleId: string,
    field: K,
    value: EditableRoleState[K],
  ) {
    setRoles((current) =>
      current.map((role) =>
        role.id === roleId ? { ...role, [field]: value } : role,
      ),
    );
  }

  async function handleSave(roleId: string) {
    const role = roles.find((item) => item.id === roleId);

    if (!role) {
      return;
    }

    setSavingRoleId(roleId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/roles/" + roleId, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: role.name,
          description: role.description,
          canAccessVereinsleitung: role.canAccessVereinsleitung,
          canAttendVereinsleitungMeetings: role.canAttendVereinsleitungMeetings,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Rolle konnte nicht gespeichert werden.");
      }

      setRoles((current) =>
        current.map((item) =>
          item.id === roleId
            ? {
                ...item,
                name: data.role.name,
                description: data.role.description ?? "",
                canAccessVereinsleitung: data.role.canAccessVereinsleitung,
                canAttendVereinsleitungMeetings:
                  data.role.canAttendVereinsleitungMeetings,
                updatedAt: data.role.updatedAt,
              }
            : item,
        ),
      );

      setMessage('Rolle "' + data.role.name + '" erfolgreich gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSavingRoleId(null);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <h3 className="fca-subheading">Rollen & Vereinsleitungs-Zugriff</h3>
            <p className="mt-3 text-sm text-slate-600">
              Admin kann hier Rollennamen, Beschreibungen sowie den Zugriff auf
              das Vereinsleitungs-Modul und die Teilnahme an Vereinsleitungs-Meetings
              steuern. Die Workflow-Matrix für Review-, Approve- und Publish-Logik
              bauen wir als nächsten Schritt darauf auf.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="fca-label">Rollen suchen</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="fca-input"
              placeholder="z. B. Finanzleiter"
            />
          </label>
        </div>

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        {message ? (
          <div className="fca-status-box fca-status-box-success">{message}</div>
        ) : null}

        {filteredRoles.length === 0 ? (
          <div className="fca-status-box fca-status-box-muted">
            Keine Rollen für den aktuellen Suchbegriff gefunden.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredRoles.map((role) => {
              const isSaving = savingRoleId === role.id;

              return (
                <div key={role.id} className="fca-section-card p-5">
                  <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="fca-label">Rollenname</span>
                          <input
                            value={role.name}
                            onChange={(event) =>
                              updateRoleField(role.id, "name", event.target.value)
                            }
                            className="fca-input"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="fca-label">Rollen-Key</span>
                          <input
                            value={role.key}
                            className="fca-input bg-slate-50 text-slate-500"
                            disabled
                          />
                        </label>
                      </div>

                      <label className="block space-y-2">
                        <span className="fca-label">Beschreibung / Scope</span>
                        <textarea
                          value={role.description}
                          onChange={(event) =>
                            updateRoleField(
                              role.id,
                              "description",
                              event.target.value,
                            )
                          }
                          className="fca-textarea min-h-[140px]"
                        />
                      </label>
                    </div>

                    <div className="space-y-4">
                      <div className="fca-section-card p-4">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Zusatzrechte
                        </p>

                        <div className="mt-4 space-y-4">
                          <label className="fca-toggle-row">
                            <span className="text-sm text-slate-700">
                              Zugriff auf Vereinsleitung
                            </span>
                            <input
                              type="checkbox"
                              checked={role.canAccessVereinsleitung}
                              onChange={(event) =>
                                updateRoleField(
                                  role.id,
                                  "canAccessVereinsleitung",
                                  event.target.checked,
                                )
                              }
                              className="fca-toggle-checkbox"
                            />
                          </label>

                          <label className="fca-toggle-row">
                            <span className="text-sm text-slate-700">
                              Darf an Vereinsleitungs-Meetings teilnehmen
                            </span>
                            <input
                              type="checkbox"
                              checked={role.canAttendVereinsleitungMeetings}
                              onChange={(event) =>
                                updateRoleField(
                                  role.id,
                                  "canAttendVereinsleitungMeetings",
                                  event.target.checked,
                                )
                              }
                              className="fca-toggle-checkbox"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Letzte Änderung: {formatDateTime(role.updatedAt)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSave(role.id)}
                        disabled={isSaving}
                        className="fca-button-primary w-full"
                      >
                        {isSaving ? "Speichern..." : "Rolle speichern"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminSurfaceCard>
  );
}
