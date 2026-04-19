"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type RoleItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

type UserFormProps = {
  mode: "create" | "edit";
  userId?: string;
  initialValues?: {
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  initialRoles?: RoleItem[];
};

export default function UserForm({
  mode,
  userId,
  initialValues,
  initialRoles = [],
}: UserFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(initialValues?.firstName ?? "");
  const [lastName, setLastName] = useState(initialValues?.lastName ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmitCreate = useMemo(() => {
    if (mode !== "create") {
      return true;
    }

    return selectedRoleIds.length > 0;
  }, [mode, selectedRoleIds]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = mode === "create" ? "/api/users/create" : "/api/users/" + userId;
      const method = mode === "create" ? "POST" : "PATCH";

      const payload =
        mode === "create"
          ? { firstName, lastName, email, roleIds: selectedRoleIds }
          : { firstName, lastName, email, isActive };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Speichern fehlgeschlagen.");
      }

      if (mode === "create" && data?.id) {
        router.push("/dashboard/users/" + data.id);
      } else {
        router.push("/dashboard/users");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="fca-label">Vorname</span>
            <input
              className="fca-input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </label>

          <label className="space-y-2">
            <span className="fca-label">Nachname</span>
            <input
              className="fca-input"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="fca-label">E-Mail</span>
          <input
            type="email"
            className="fca-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        {mode === "create" ? (
          <div className="space-y-4">
            <div>
              <h3 className="fca-subheading">Rollen zuweisen</h3>
              <p className="mt-3 text-sm text-slate-600">
                Vor dem Erstellen muss mindestens eine Rolle zugewiesen werden. Danach kann die Einladung sofort versendet werden.
              </p>
            </div>

            {initialRoles.length === 0 ? (
              <div className="fca-status-box fca-status-box-error">
                Keine Rollen gefunden. Bitte zuerst Rollen anlegen.
              </div>
            ) : (
              <div className="grid gap-3">
                {initialRoles.map((role) => (
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

            <div className="fca-status-box fca-status-box-muted">
              Benutzer wird ohne Passwort erstellt. Die eingeladene Person setzt ihr persönliches Passwort selbst über den Einladungslink.
            </div>
          </div>
        ) : (
          <label className="fca-toggle-row">
            <span className="text-sm text-slate-700">Benutzer ist aktiv</span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="fca-toggle-checkbox"
            />
          </label>
        )}

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || (mode === "create" && !canSubmitCreate)}
            className="fca-button-primary"
          >
            {submitting
              ? "Speichern..."
              : mode === "create"
                ? "Benutzer erstellen"
                : "Benutzer speichern"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/users")}
            className="fca-button-secondary"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </AdminSurfaceCard>
  );
}