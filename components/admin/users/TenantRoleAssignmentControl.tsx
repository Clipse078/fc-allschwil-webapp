"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Shield } from "lucide-react";

type RoleOption = {
  id: string;
  name: string;
  isSystem: boolean;
};

type Props = {
  userId: string;
  availableRoles: RoleOption[];
  initialRoleIds: string[];
  canManage: boolean;
};

export default function TenantRoleAssignmentControl({
  userId,
  availableRoles,
  initialRoleIds,
  canManage,
}: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialRoleIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty =
    selectedIds.size !== initialRoleIds.length ||
    initialRoleIds.some((id) => !selectedIds.has(id));

  function toggle(roleId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(roleId);
      } else {
        next.delete(roleId);
      }
      return next;
    });
    setError(null);
  }

  function save() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/roles`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleIds: Array.from(selectedIds) }),
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

  if (availableRoles.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Keine Rollen für diesen Club definiert.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {availableRoles.map((role) => {
          const checked = selectedIds.has(role.id);
          return (
            <li key={role.id} className="flex items-center gap-3">
              {canManage ? (
                <input
                  type="checkbox"
                  id={`role-${role.id}`}
                  checked={checked}
                  disabled={isPending}
                  onChange={(e) => toggle(role.id, e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] accent-[var(--primary)] disabled:opacity-50"
                />
              ) : (
                <span
                  aria-label={checked ? "Zugewiesen" : "Nicht zugewiesen"}
                  className={`inline-block h-4 w-4 rounded border ${
                    checked
                      ? "border-[var(--primary)] bg-[var(--primary)]"
                      : "border-[var(--border)] bg-white"
                  }`}
                />
              )}
              <label
                htmlFor={canManage ? `role-${role.id}` : undefined}
                className={`flex items-center gap-1.5 text-sm select-none ${
                  canManage ? "cursor-pointer" : "cursor-default"
                } text-[var(--foreground)]`}
              >
                {role.isSystem ? (
                  <Shield className="h-3 w-3 flex-shrink-0 text-[var(--muted)]" />
                ) : null}
                {role.name}
              </label>
            </li>
          );
        })}
      </ul>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {canManage ? (
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || isPending}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Speichern…" : "Änderungen speichern"}
        </button>
      ) : null}
    </div>
  );
}
