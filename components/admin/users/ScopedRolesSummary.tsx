"use client";

/**
 * ScopedRolesSummary — ORG-ACCESS-02
 *
 * Read-only display of a user's scoped role assignments in the
 * consolidated user detail view (Rollen & Zuständigkeiten / Bereiche).
 *
 * Management of individual scoped assignments is done via the OrgUnit
 * or Team pages — this is intentionally read-only here per the spec:
 * "User Management consolidates it" (not the primary workflow).
 */

import { Building2, Shield } from "lucide-react";
import Link from "next/link";

export type ScopedRoleItem = {
  id: string;
  roleName: string;
  orgUnitId: string;
  orgUnitName: string;
  scopeMode: "THIS_ORG_UNIT" | "THIS_ORG_UNIT_AND_DESCENDANTS";
};

type Props = {
  assignments: ScopedRoleItem[];
};

const SCOPE_SUFFIX: Record<string, string | null> = {
  THIS_ORG_UNIT: null,
  THIS_ORG_UNIT_AND_DESCENDANTS: "+ Unterbereiche",
};

export default function ScopedRolesSummary({ assignments }: Props) {
  if (assignments.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Keine Bereichszuständigkeiten zugewiesen.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {assignments.map((a) => (
        <li key={a.id} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
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
        </li>
      ))}
    </ul>
  );
}
