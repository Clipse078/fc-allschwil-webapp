"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  buildNavPermissionPresentationFromModuleGroups,
  isControlChecked,
  isWochenplannerAvailable,
  togglePermissionKey,
  toggleStandardControl,
  type PermissionPresentationSection,
  type PermissionUnit,
  type StandardControl,
} from "@/lib/roles/nav-permission-presentation";
import {
  collectAllGrantableKeys,
  countSectionModules,
  getPermissionSectionAccent,
  getPermissionSectionStatus,
  getPermissionSectionStatusLabel,
  getUnitAccentForSection,
} from "@/lib/roles/permission-section-presentation";
import { AnimatedNavIcon } from "@/components/ui/motion/AnimatedNavIcon";
import { SwitchThumb } from "@/components/ui/SwitchToggle";
import { cn } from "@/lib/cn";

export type PermissionMatrixModuleGroup = {
  module: string;
  permissions: Array<{ id: string; key: string; name: string; module: string }>;
};

type NavAlignedPermissionEditorProps = {
  moduleGroups: PermissionMatrixModuleGroup[];
  selectedKeys: Set<string>;
  lockedKeys?: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
};

function countUnitAdvancedSelections(unit: PermissionUnit, selectedKeys: Set<string>) {
  return unit.advancedPermissions.filter((permission) => selectedKeys.has(permission.key)).length;
}

function countUnitSelections(unit: PermissionUnit, selectedKeys: Set<string>) {
  let count = 0;

  for (const control of unit.standardControls) {
    if (isControlChecked(control, selectedKeys)) count += 1;
  }

  count += countUnitAdvancedSelections(unit, selectedKeys);

  if (unit.isDerived && isWochenplannerAvailable(selectedKeys)) {
    count += 1;
  }

  return count;
}

function PermissionUnitIcon({
  unit,
  sectionLabel,
  selectedKeys,
}: {
  unit: PermissionUnit;
  sectionLabel: string;
  selectedKeys: Set<string>;
}) {
  const { accent, accentSurface } = getUnitAccentForSection(sectionLabel, unit, selectedKeys);

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: accentSurface, color: accent }}
    >
      <AnimatedNavIcon
        label={unit.iconLabel}
        variant="child"
        active={countUnitSelections(unit, selectedKeys) > 0}
        className="pointer-events-none"
      />
    </span>
  );
}

function InlineControl({
  unit,
  control,
  selectedKeys,
  lockedKeys,
  disabled,
  onChange,
}: {
  unit: PermissionUnit;
  control: StandardControl | undefined;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
}) {
  if (!control) {
    return (
      <span className="flex h-8 items-center justify-center text-sm text-[var(--muted)]/50">
        —
      </span>
    );
  }

  const checked = isControlChecked(control, selectedKeys);
  const locked = control.permissionKeys.every((key) => lockedKeys.has(key));
  const id = `${unit.id}-${control.kind}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[0.62rem] font-medium text-[var(--muted)] sm:hidden">
        {control.label}
      </span>
      <SwitchThumb
        id={id}
        checked={checked}
        disabled={disabled || locked}
        onChange={(nextChecked) =>
          onChange(toggleStandardControl(selectedKeys, control, nextChecked))
        }
        aria-label={`${unit.label}: ${control.label}`}
      />
    </div>
  );
}

function AdvancedRightsControl({
  unit,
  selectedKeys,
  lockedKeys,
  disabled,
  onChange,
}: {
  unit: PermissionUnit;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
}) {
  if (unit.advancedPermissions.length === 0) return <span aria-hidden="true" />;

  const selectedCount = countUnitAdvancedSelections(unit, selectedKeys);

  return (
    <details className="group text-right">
      <summary
        className="inline-flex cursor-pointer list-none items-center justify-end gap-1 text-[0.68rem] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text-2)]"
      >
        Erweiterte Rechte
        {selectedCount > 0 ? (
          <span
            className="rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold"
            style={{
              backgroundColor: "color-mix(in srgb, var(--sce-primary) 12%, transparent)",
              color: "var(--sce-primary)",
            }}
          >
            {selectedCount}
          </span>
        ) : null}
        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
      </summary>

      <div className="mt-2 space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 p-2 text-left">
        {unit.advancedPermissions.map((advanced) => {
          const id = `advanced-${unit.id}-${advanced.key}`;
          const checked = selectedKeys.has(advanced.key);
          const locked = lockedKeys.has(advanced.key);

          return (
            <div
              key={advanced.key}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-1 py-1.5",
                disabled || locked ? "opacity-50" : "",
              )}
            >
              <div className="min-w-0">
                <label
                  htmlFor={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-1 text-xs font-medium",
                    advanced.dangerous && checked
                      ? "text-amber-400"
                      : "text-[var(--foreground)]",
                  )}
                >
                  {advanced.label}
                  {advanced.dangerous ? (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
                  ) : null}
                </label>
                {advanced.description ? (
                  <p className="mt-0.5 text-[0.65rem] leading-snug text-[var(--muted)]">
                    {advanced.description}
                  </p>
                ) : null}
              </div>

              <SwitchThumb
                id={id}
                checked={checked}
                disabled={disabled || locked}
                onChange={(nextChecked) =>
                  onChange(togglePermissionKey(selectedKeys, advanced.key, nextChecked))
                }
                aria-label={advanced.label}
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function PermissionUnitRow({
  unit,
  sectionLabel,
  selectedKeys,
  lockedKeys,
  disabled,
  onChange,
}: {
  unit: PermissionUnit;
  sectionLabel: string;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
}) {
  const viewControl = unit.standardControls.find((control) => control.kind === "view");
  const manageControl = unit.standardControls.find((control) => control.kind === "manage");
  const selectedCount = countUnitSelections(unit, selectedKeys);
  const derivedAvailable = unit.isDerived && isWochenplannerAvailable(selectedKeys);
  const sectionAccent = getPermissionSectionAccent(sectionLabel);

  return (
    <div
      className={cn(
        "grid items-center gap-x-4 gap-y-2 border-b border-[var(--border)] px-4 py-3 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_4.5rem_4.5rem_minmax(5.5rem,7rem)] sm:px-5",
        selectedCount > 0 ? "bg-[var(--surface-2)]/20" : "",
      )}
      style={
        selectedCount > 0
          ? { backgroundColor: sectionAccent.accentSurface }
          : undefined
      }
    >
      <div className="hidden sm:block">
        <PermissionUnitIcon
          unit={unit}
          sectionLabel={sectionLabel}
          selectedKeys={selectedKeys}
        />
      </div>

      <div className="min-w-0 sm:col-start-2">
        <div className="flex items-start gap-2.5">
          <span className="sm:hidden">
            <PermissionUnitIcon
              unit={unit}
              sectionLabel={sectionLabel}
              selectedKeys={selectedKeys}
            />
          </span>

          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)]">{unit.label}</p>

            {unit.description ? (
              <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
                {unit.description}
              </p>
            ) : null}

            {unit.isDerived ? (
              <p
                className={cn(
                  "mt-1 text-xs",
                  derivedAvailable
                    ? "font-medium text-emerald-400"
                    : "text-[var(--muted)]",
                )}
              >
                {derivedAvailable ? "Automatisch verfügbar" : "Noch nicht verfügbar"}
                {unit.derivedNote ? ` — ${unit.derivedNote}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {!unit.isDerived ? (
        <>
          <div className="hidden sm:flex sm:flex-col sm:items-center sm:gap-1">
            <span className="text-[0.62rem] font-medium text-[var(--muted)]">Ansehen</span>
            <InlineControl
              unit={unit}
              control={viewControl}
              selectedKeys={selectedKeys}
              lockedKeys={lockedKeys}
              disabled={disabled}
              onChange={onChange}
            />
          </div>

          <div className="hidden sm:flex sm:flex-col sm:items-center sm:gap-1">
            <span className="text-[0.62rem] font-medium text-[var(--muted)]">Verwalten</span>
            <InlineControl
              unit={unit}
              control={manageControl}
              selectedKeys={selectedKeys}
              lockedKeys={lockedKeys}
              disabled={disabled}
              onChange={onChange}
            />
          </div>

          <div className="hidden sm:block">
            <AdvancedRightsControl
              unit={unit}
              selectedKeys={selectedKeys}
              lockedKeys={lockedKeys}
              disabled={disabled}
              onChange={onChange}
            />
          </div>

          <div className="col-span-full space-y-2 sm:hidden">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-2)]">Ansehen</span>
              <InlineControl
                unit={unit}
                control={viewControl}
                selectedKeys={selectedKeys}
                lockedKeys={lockedKeys}
                disabled={disabled}
                onChange={onChange}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-2)]">Verwalten</span>
              <InlineControl
                unit={unit}
                control={manageControl}
                selectedKeys={selectedKeys}
                lockedKeys={lockedKeys}
                disabled={disabled}
                onChange={onChange}
              />
            </div>
            <AdvancedRightsControl
              unit={unit}
              selectedKeys={selectedKeys}
              lockedKeys={lockedKeys}
              disabled={disabled}
              onChange={onChange}
            />
          </div>
        </>
      ) : (
        <>
          <span className="hidden sm:col-span-3 sm:block" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

function PermissionSection({
  section,
  selectedKeys,
  lockedKeys,
  disabled,
  onChange,
  defaultOpen,
  forceOpen,
}: {
  section: PermissionPresentationSection;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
  defaultOpen: boolean;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen ?? open;
  const accent = getPermissionSectionAccent(section.label);
  const status = getPermissionSectionStatus(section, selectedKeys);
  const statusLabel = getPermissionSectionStatusLabel(status);
  const moduleCount = countSectionModules(section);

  return (
    <section
      className="overflow-hidden rounded-xl border transition-colors"
      style={{
        borderColor: isOpen ? accent.accentBorder : "var(--border)",
        backgroundColor: isOpen ? accent.accentSurface : "var(--surface)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={isOpen}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: accent.accentSurface,
            color: accent.accent,
          }}
        >
          <accent.icon className="h-4 w-4" aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {section.label}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {accent.description}
          </span>
        </span>

        <span className="hidden items-center gap-2 sm:flex">
          <span
            className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold tabular-nums"
            style={{
              backgroundColor: accent.accentSurface,
              color: accent.accent,
            }}
          >
            {moduleCount} Module
          </span>

          <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-[var(--text-2)]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: status === "inactive" ? "var(--muted)" : accent.accent,
              }}
              aria-hidden="true"
            />
            {statusLabel}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
            isOpen ? "rotate-180" : "",
          )}
        />
      </button>

      {isOpen ? (
        <div className="border-t" style={{ borderColor: accent.accentBorder }}>
          <div
            className="hidden grid-cols-[2rem_minmax(0,1fr)_4.5rem_4.5rem_minmax(5.5rem,7rem)] items-center gap-x-4 border-b px-5 py-2 sm:grid"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "color-mix(in srgb, var(--surface-2) 55%, transparent)",
            }}
          >
            <span aria-hidden="true" />
            <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Modul
            </span>
            <span className="text-center text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Ansehen
            </span>
            <span className="text-center text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Verwalten
            </span>
            <span className="text-right text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Erweitert
            </span>
          </div>

          {section.units.map((unit) => (
            <PermissionUnitRow
              key={unit.id}
              unit={unit}
              sectionLabel={section.label}
              selectedKeys={selectedKeys}
              lockedKeys={lockedKeys}
              disabled={disabled}
              onChange={onChange}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SupplementalPermissions({
  unit,
  selectedKeys,
  lockedKeys,
  disabled,
  onChange,
}: {
  unit: PermissionUnit;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
}) {
  const selectionCount = countUnitSelections(unit, selectedKeys);

  return (
    <details className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-left sm:px-5">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
        <span className="text-xs font-medium text-[var(--muted)]">Weitere Zugriffsrechte</span>
        {selectionCount > 0 ? (
          <span className="rounded-full bg-[var(--sce-primary)]/10 px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--sce-primary)]">
            {selectionCount}
          </span>
        ) : null}
      </summary>

      <div className="border-t border-[var(--border)]">
        {unit.advancedPermissions.length > 0 || unit.standardControls.length > 0 ? (
          unit.standardControls.length > 0 ? (
            <PermissionUnitRow
              unit={unit}
              sectionLabel="System"
              selectedKeys={selectedKeys}
              lockedKeys={lockedKeys}
              disabled={disabled}
              onChange={onChange}
            />
          ) : (
            <div className="space-y-1 p-4">
              {unit.advancedPermissions.map((advanced) => {
                const id = `supplemental-${advanced.key}`;
                const checked = selectedKeys.has(advanced.key);
                const locked = lockedKeys.has(advanced.key);

                return (
                  <div key={advanced.key} className="flex items-center justify-between gap-3 py-1">
                    <label htmlFor={id} className="text-xs font-medium text-[var(--foreground)]">
                      {advanced.label}
                    </label>
                    <SwitchThumb
                      id={id}
                      checked={checked}
                      disabled={disabled || locked}
                      onChange={(nextChecked) =>
                        onChange(togglePermissionKey(selectedKeys, advanced.key, nextChecked))
                      }
                      aria-label={advanced.label}
                    />
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </div>
    </details>
  );
}

export default function NavAlignedPermissionEditor({
  moduleGroups,
  selectedKeys,
  lockedKeys = new Set(),
  onChange,
  disabled = false,
}: NavAlignedPermissionEditorProps) {
  const [expandAll, setExpandAll] = useState<boolean | null>(null);

  const presentation = useMemo(
    () => buildNavPermissionPresentationFromModuleGroups(moduleGroups),
    [moduleGroups],
  );

  if (presentation.sections.length === 0 && !presentation.supplementalUnit) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-[var(--muted)]">
          Keine mandanten-fähigen Berechtigungen in der Datenbank gefunden.
        </p>
      </div>
    );
  }

  function handleExpandAll() {
    setExpandAll(true);
  }

  function handleClearAll() {
    const grantable = collectAllGrantableKeys(
      presentation.sections,
      presentation.supplementalUnit,
    );
    const next = new Set<string>();
    for (const key of lockedKeys) {
      if (grantable.includes(key) || selectedKeys.has(key)) {
        next.add(key);
      }
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
            Module & Berechtigungen
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Entspricht der SCE-Navigation — Ansehen und Verwalten pro Modul.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.68rem] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Alles einblenden
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={disabled}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.68rem] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            Alle deaktivieren
          </button>
        </div>
      </div>

      {presentation.sections.map((section) => (
        <PermissionSection
          key={section.key}
          section={section}
          selectedKeys={selectedKeys}
          lockedKeys={lockedKeys}
          disabled={disabled}
          onChange={onChange}
          defaultOpen={section.label === "Organisation"}
          forceOpen={expandAll === true ? true : undefined}
        />
      ))}

      {presentation.supplementalUnit ? (
        <SupplementalPermissions
          unit={presentation.supplementalUnit}
          selectedKeys={selectedKeys}
          lockedKeys={lockedKeys}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

export { buildNavPermissionPresentationFromModuleGroups };
