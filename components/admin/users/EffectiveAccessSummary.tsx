"use client";

import type { EffectiveAccessModuleGroup } from "@/lib/roles/effective-access-summary";

type Props = {
  groups: EffectiveAccessModuleGroup[];
  loading?: boolean;
  emptyMessage?: string;
  compact?: boolean;
};

/**
 * Concise, human-readable effective-access summary for Club Admins.
 * Shows module labels and permission names — never raw permission keys.
 */
export default function EffectiveAccessSummary({
  groups,
  loading = false,
  emptyMessage = "Keine Berechtigungen aus den gewählten Rollen.",
  compact = false,
}: Props) {
  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Zugriff wird berechnet…</p>;
  }

  if (groups.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>;
  }

  return (
    <ul className={compact ? "space-y-3" : "space-y-4"}>
      {groups.map((group) => (
        <li key={group.module}>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            {group.moduleLabel}
          </p>
          {group.hasAccess ? (
            <ul className="mt-1.5 space-y-1">
              {group.items.map((item) => (
                <li key={item} className="text-sm text-[var(--foreground)]">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-[var(--muted)]">Kein Zugriff</p>
          )}
        </li>
      ))}
    </ul>
  );
}
