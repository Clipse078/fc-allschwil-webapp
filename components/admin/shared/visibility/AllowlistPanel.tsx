"use client";

import { useEffect, useState } from "react";
import { Users, ShieldCheck, Loader2 } from "lucide-react";
import VisibleRolesSelect, { type RoleOption } from "./VisibleRolesSelect";
import VisibleUsersSelect, { type UserOption } from "./VisibleUsersSelect";
import type { VisibilityScopeValue } from "@/components/admin/shared/VisibilityScopeSelect";

type AllowlistPanelProps = {
  visibilityScope: VisibilityScopeValue;
  visibleRoleRefs: string[];
  visibleUserRefs: string[];
  onRolesChange: (keys: string[]) => void;
  onUsersChange: (ids: string[]) => void;
};

export default function AllowlistPanel({
  visibilityScope,
  visibleRoleRefs,
  visibleUserRefs,
  onRolesChange,
  onUsersChange,
}: AllowlistPanelProps) {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fetched, setFetched] = useState(false);

  // Derived loading state — never call setState synchronously in an effect
  const isLoading = visibilityScope === "RESTRICTED" && !fetched;

  useEffect(() => {
    if (visibilityScope !== "RESTRICTED" || fetched) return;

    Promise.all([
      fetch("/api/roles").then((r) => r.json()).catch(() => ({ roles: [] })),
      fetch("/api/users/select").then((r) => r.json()).catch(() => []),
    ]).then(([rolesData, usersData]) => {
      setRoles(
        (rolesData.roles ?? []).map((r: { key: string; name: string }) => ({
          key: r.key,
          name: r.name,
        })),
      );
      setUsers(Array.isArray(usersData) ? usersData : []);
      setFetched(true);
    });
  }, [visibilityScope, fetched]);

  if (visibilityScope !== "RESTRICTED") return null;

  return (
    <section className="rounded-[24px] border border-amber-200/80 bg-amber-50/50 p-5">
      <div className="mb-4 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="text-[13px] font-semibold text-amber-800">
            Eingeschränkte Sichtbarkeit — Zugriff konfigurieren
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            Nur Benutzer mit einer der erlaubten Rollen oder explizit genannte Personen können
            diesen Eintrag sehen. Der Ersteller hat immer Zugriff.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-amber-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Rollen und Benutzer…
        </div>
      ) : (
        <div className="space-y-5">
          <VisibleRolesSelect
            selected={visibleRoleRefs}
            options={roles}
            onChange={onRolesChange}
          />

          <div className="border-t border-amber-200" />

          <VisibleUsersSelect
            selected={visibleUserRefs}
            options={users}
            onChange={onUsersChange}
          />

          {visibleRoleRefs.length === 0 && visibleUserRefs.length === 0 ? (
            <div className="flex items-center gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700">
              <Users className="h-3.5 w-3.5 shrink-0" />
              Bisher keine Zugriffsbeschränkungen konfiguriert — nur du als Ersteller siehst diesen
              Eintrag.
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
