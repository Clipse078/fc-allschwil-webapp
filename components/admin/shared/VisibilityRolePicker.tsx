"use client";

import { useEffect, useState } from "react";

type Role = {
  id: string;
  name?: string | null;
  key?: string | null;
};

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
};

function getRoleLabel(role: Role) {
  return role.name || role.key || "Unbekannte Rolle";
}

export default function VisibilityRolePicker({ value, onChange }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRoles() {
      setLoading(true);

      try {
        const response = await fetch("/api/roles", { cache: "no-store" });

        if (!response.ok) {
          setRoles([]);
          return;
        }

        const data = await response.json();
        setRoles(Array.isArray(data) ? data : data.roles ?? []);
      } finally {
        setLoading(false);
      }
    }

    loadRoles();
  }, []);

  function toggleRole(roleId: string) {
    if (value.includes(roleId)) {
      onChange(value.filter((id) => id !== roleId));
      return;
    }

    onChange([...value, roleId]);
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-900">Rollen auswählen</div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Rollen werden geladen...
        </div>
      ) : (
        <div className="max-h-56 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2">
          {roles.length === 0 ? (
            <div className="px-2 py-2 text-sm text-slate-500">Keine Rollen gefunden.</div>
          ) : (
            roles.map((role) => {
              const active = value.includes(role.id);

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRole(role.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <span>{getRoleLabel(role)}</span>
                  {active ? <span className="text-xs">Ausgewählt</span> : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
