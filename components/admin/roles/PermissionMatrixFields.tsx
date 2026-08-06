"use client";

import { moduleLabel, moduleSortIndex } from "@/lib/roles/module-labels";
import { Lock } from "lucide-react";

export type PermissionMatrixModuleGroup = {
  module: string;
  permissions: Array<{ id: string; key: string; name: string; module: string }>;
};

type PermissionMatrixFieldsProps = {
  moduleGroups: PermissionMatrixModuleGroup[];
  selectedKeys: Set<string>;
  /** Keys that must always render checked and disabled (essential system-role permissions). */
  lockedKeys?: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
};

/**
 * Pure, controlled module-grouped permission checklist. Presentation-only —
 * module grouping never gates access (architectural principle 2); it only
 * decides layout. Bulk actions operate on real `Permission.key` values, per
 * "no permission key ambiguity / do not hide individual permission keys
 * behind an opaque module toggle" — every key is rendered individually.
 */
export default function PermissionMatrixFields({
  moduleGroups,
  selectedKeys,
  lockedKeys = new Set(),
  onChange,
  disabled = false,
}: PermissionMatrixFieldsProps) {
  const sortedGroups = [...moduleGroups].sort(
    (a, b) => moduleSortIndex(a.module) - moduleSortIndex(b.module),
  );

  function toggleKey(key: string, checked: boolean) {
    if (disabled || lockedKeys.has(key)) return;
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  }

  function toggleModule(keys: string[], checked: boolean) {
    if (disabled) return;
    const next = new Set(selectedKeys);
    for (const key of keys) {
      if (lockedKeys.has(key)) continue;
      if (checked) next.add(key);
      else next.delete(key);
    }
    onChange(next);
  }

  if (sortedGroups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-[var(--muted)]">
          Keine mandanten-fähigen Berechtigungen in der Datenbank gefunden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sortedGroups.map(({ module, permissions }) => {
        const keys = permissions.map((p) => p.key);
        const checkedInModule = keys.filter((k) => selectedKeys.has(k)).length;
        const allChecked = checkedInModule === keys.length;
        const someChecked = checkedInModule > 0 && !allChecked;

        return (
          <div key={module} className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    disabled={disabled}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={(e) => toggleModule(keys, e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-[var(--blue)] disabled:cursor-not-allowed"
                    aria-label={`Alle Berechtigungen in ${moduleLabel(module)} auswählen`}
                  />
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {moduleLabel(module)}
                  </span>
                </label>
                <span className="text-[0.68rem] text-[var(--muted)]">
                  {checkedInModule}/{keys.length}
                </span>
              </div>
            </div>
            <div className="sce-detail-section-body">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {permissions.map((perm) => {
                  const isLocked = lockedKeys.has(perm.key);
                  return (
                    <label
                      key={perm.id}
                      className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 transition hover:border-[var(--blue)] hover:bg-[var(--blue-light)] aria-disabled:cursor-not-allowed aria-disabled:opacity-70"
                      aria-disabled={disabled || isLocked}
                    >
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(perm.key)}
                        disabled={disabled || isLocked}
                        onChange={(e) => toggleKey(perm.key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--blue)] disabled:cursor-not-allowed"
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[0.78rem] font-semibold leading-snug text-[var(--foreground)]">
                          {perm.name}
                          {isLocked && <Lock className="h-3 w-3 text-amber-600" aria-hidden="true" />}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[0.65rem] text-[var(--muted)]">
                          {perm.key}
                        </p>
                        {isLocked && (
                          <p className="mt-0.5 text-[0.65rem] text-amber-700">
                            Systemkritisch — kann nicht entfernt werden
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
