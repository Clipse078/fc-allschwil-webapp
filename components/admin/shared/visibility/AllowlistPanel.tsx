"use client";

import { useEffect, useState } from "react";
import { Building2, ShieldCheck, Loader2 } from "lucide-react";
import VisibleOrgUnitsSelect, { type OrgUnitOption } from "./VisibleOrgUnitsSelect";
import VisibleRolesSelect, { type RoleOption } from "./VisibleRolesSelect";
import VisibleUsersSelect, { type UserOption } from "./VisibleUsersSelect";
import type { VisibilityScopeValue } from "@/components/admin/shared/VisibilityScopeSelect";

type AllowlistPanelProps = {
  visibilityScope: VisibilityScopeValue;
  visibleOrgUnitRefs: string[];
  visibleRoleRefs: string[];
  visibleUserRefs: string[];
  onOrgUnitsChange: (ids: string[]) => void;
  onRolesChange: (keys: string[]) => void;
  onUsersChange: (ids: string[]) => void;
};

export default function AllowlistPanel({
  visibilityScope,
  visibleOrgUnitRefs,
  visibleRoleRefs,
  visibleUserRefs,
  onOrgUnitsChange,
  onRolesChange,
  onUsersChange,
}: AllowlistPanelProps) {
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fetched, setFetched] = useState(false);

  const isLoading = visibilityScope === "RESTRICTED" && !fetched;

  useEffect(() => {
    if (visibilityScope !== "RESTRICTED" || fetched) return;

    Promise.all([
      fetch("/api/org-units").then((r) => r.json()).catch(() => ({ orgUnits: [] })),
      fetch("/api/roles").then((r) => r.json()).catch(() => ({ roles: [] })),
      fetch("/api/users/select").then((r) => r.json()).catch(() => []),
    ]).then(([orgData, rolesData, usersData]) => {
      setOrgUnits(
        (orgData.orgUnits ?? []).map((u: { id: string; key: string; name: string; type: string; level: number }) => ({
          id: u.id, key: u.key, name: u.name, type: u.type, level: u.level,
        })),
      );
      setRoles(
        (rolesData.roles ?? []).map((r: { key: string; name: string }) => ({
          key: r.key, name: r.name,
        })),
      );
      setUsers(Array.isArray(usersData) ? usersData : []);
      setFetched(true);
    });
  }, [visibilityScope, fetched]);

  if (visibilityScope !== "RESTRICTED") return null;

  const totalSelected = visibleOrgUnitRefs.length + visibleRoleRefs.length + visibleUserRefs.length;

  return (
    <section className="rounded-[24px] border border-amber-200/80 bg-amber-50/50 p-5">
      <div className="mb-4 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="text-[13px] font-semibold text-amber-800">
            Eingeschränkte Sichtbarkeit — Zugriff konfigurieren
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            Nur Mitglieder gewählter Organisationseinheiten, Rollen oder explizit genannte
            Personen können diesen Eintrag sehen. Der Ersteller hat immer Zugriff.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-amber-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Einheiten, Rollen und Benutzer…
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. Org Units — primary scalable abstraction */}
          <VisibleOrgUnitsSelect
            selected={visibleOrgUnitRefs}
            options={orgUnits}
            onChange={onOrgUnitsChange}
          />

          <div className="border-t border-amber-200" />

          {/* 2. Roles — precise overrides */}
          <VisibleRolesSelect
            selected={visibleRoleRefs}
            options={roles}
            onChange={onRolesChange}
          />

          <div className="border-t border-amber-200" />

          {/* 3. Users — individual overrides */}
          <VisibleUsersSelect
            selected={visibleUserRefs}
            options={users}
            onChange={onUsersChange}
          />

          {totalSelected === 0 ? (
            <div className="flex items-center gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              Bisher keine Zugriffsbeschränkungen konfiguriert — nur du als Ersteller siehst diesen
              Eintrag.
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
