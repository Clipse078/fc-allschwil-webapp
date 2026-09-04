"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  Globe,
  KeyRound,
  LayoutGrid,
  Lock,
  Monitor,
  Newspaper,
  Shield,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SwitchThumb } from "@/components/ui/SwitchToggle";
import { moduleLabel, moduleSortIndex } from "@/lib/roles/module-labels";
import {
  getPermissionDisplayMeta,
  moduleDisplayDescription,
} from "@/lib/roles/permission-metadata";
import { cn } from "@/lib/cn";

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
  /** Show raw permission keys in a subtle advanced treatment. */
  showRawKeys?: boolean;
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  ORG: Building2,
  WEBSITE: Globe,
  TRAININGS: Calendar,
  EVENTS: Trophy,
  WOCHENPLAN: LayoutGrid,
  FIXTURES: Trophy,
  TEAMS: Users,
  PEOPLE: Users,
  NEWS: Newspaper,
  INFOBOARD: Monitor,
  ROLES: KeyRound,
  USERS: Shield,
  TARGETS: Target,
  WORKSPACE: FileText,
};

function getModuleIcon(module: string): LucideIcon {
  return MODULE_ICONS[module] ?? Shield;
}

/**
 * Controlled module-grouped permission selector with collapsible modules and
 * toggle switches. Presentation-only — module grouping never gates access.
 */
export default function PermissionMatrixFields({
  moduleGroups,
  selectedKeys,
  lockedKeys = new Set(),
  onChange,
  disabled = false,
  showRawKeys = false,
}: PermissionMatrixFieldsProps) {
  const sortedGroups = useMemo(
    () =>
      [...moduleGroups].sort(
        (a, b) => moduleSortIndex(a.module) - moduleSortIndex(b.module),
      ),
    [moduleGroups],
  );

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const allExpanded =
    sortedGroups.length > 0 && expandedModules.size === sortedGroups.length;

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

  function toggleModuleExpanded(module: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedModules(new Set());
    } else {
      setExpandedModules(new Set(sortedGroups.map((g) => g.module)));
    }
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Berechtigungen auswählen
        </p>
        <button
          type="button"
          onClick={toggleExpandAll}
          className="text-xs font-medium text-[var(--text-2)] transition hover:text-[var(--foreground)]"
        >
          {allExpanded ? "Alle ausblenden" : "Alle einblenden"}
        </button>
      </div>

      <div className="space-y-3">
        {sortedGroups.map(({ module, permissions }) => {
          const keys = permissions.map((p) => p.key);
          const selectableKeys = keys.filter((k) => !lockedKeys.has(k));
          const checkedInModule = keys.filter((k) => selectedKeys.has(k)).length;
          const allChecked =
            selectableKeys.length > 0 &&
            selectableKeys.every((k) => selectedKeys.has(k));
          const someChecked = checkedInModule > 0 && !allChecked;
          const isExpanded = expandedModules.has(module);
          const ModuleIcon = getModuleIcon(module);
          const hasSelection = checkedInModule > 0;

          return (
            <div
              key={module}
              className={cn(
                "overflow-hidden rounded-xl border bg-[var(--surface)] shadow-sm transition-colors",
                hasSelection
                  ? "border-[var(--sce-primary)]/30"
                  : "border-[var(--border)]",
              )}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => toggleModuleExpanded(module)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2 rounded-md"
                  aria-expanded={isExpanded}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      hasSelection
                        ? "bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]"
                        : "bg-[var(--surface-2)] text-[var(--muted)]",
                    )}
                  >
                    <ModuleIcon className="h-4 w-4" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {moduleLabel(module)}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {permissions.length} Berechtigung
                        {permissions.length === 1 ? "" : "en"}
                        {checkedInModule > 0 ? ` · ${checkedInModule} ausgewählt` : ""}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-2)]">
                      {moduleDisplayDescription(module)}
                    </span>
                  </span>

                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
                      isExpanded && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>

                <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                  <SwitchThumb
                    id={`module-all-${module}`}
                    checked={allChecked}
                    onChange={(checked) => toggleModule(keys, checked)}
                    disabled={disabled || selectableKeys.length === 0}
                    aria-label={`Alle Berechtigungen in ${moduleLabel(module)} ${allChecked ? "deaktivieren" : "aktivieren"}`}
                  />
                  {someChecked && !allChecked ? (
                    <span className="text-[0.65rem] text-[var(--muted)]">Teilweise</span>
                  ) : null}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-3">
                  <div className="space-y-2">
                    {permissions.map((perm) => {
                      const isLocked = lockedKeys.has(perm.key);
                      const meta = getPermissionDisplayMeta(
                        perm.key,
                        perm.name,
                        perm.module,
                      );
                      const isChecked = selectedKeys.has(perm.key);

                      return (
                        <div
                          key={perm.id}
                          className={cn(
                            "flex items-start justify-between gap-4 rounded-lg border px-3 py-3",
                            meta.dangerous && isChecked
                              ? "border-amber-500/30 bg-amber-500/5"
                              : "border-[var(--border)] bg-[var(--surface)]",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                              {meta.label}
                              {isLocked ? (
                                <Lock
                                  className="h-3 w-3 text-amber-600"
                                  aria-hidden="true"
                                />
                              ) : null}
                              {meta.dangerous ? (
                                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">
                                  Kritisch
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-2)]">
                              {meta.description}
                            </p>
                            {isLocked ? (
                              <p className="mt-1 text-[0.65rem] text-amber-700">
                                Systemkritisch — kann nicht entfernt werden
                              </p>
                            ) : null}
                            {showRawKeys ? (
                              <p className="mt-1 font-mono text-[0.6rem] text-[var(--muted)]">
                                {perm.key}
                              </p>
                            ) : null}
                          </div>

                          <SwitchThumb
                            id={`perm-${perm.key}`}
                            checked={isChecked}
                            onChange={(checked) => toggleKey(perm.key, checked)}
                            disabled={disabled || isLocked}
                            aria-label={meta.label}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
