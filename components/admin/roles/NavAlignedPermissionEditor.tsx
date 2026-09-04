"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Compass,
  Globe2,
  Settings2,
  ShieldCheck,
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

const SECTION_META: Record<
  string,
  {
    description: string;
    icon: typeof Building2;
  }
> = {
  Organisation: {
    description: "Vereinsstruktur, Teams, Personen und sportliche Organisation.",
    icon: Building2,
  },
  Website: {
    description: "Öffentliche Inhalte, News und Website-Verwaltung.",
    icon: Globe2,
  },
  Betrieb: {
    description: "Training, Spielbetrieb, Wochenplanung und operative Abläufe.",
    icon: Compass,
  },
  Führung: {
    description: "Führungs- und Steuerungsbereiche des Vereins.",
    icon: ShieldCheck,
  },
  System: {
    description: "Administration, Zugänge, Rollen und Systemeinstellungen.",
    icon: Settings2,
  },
};

function countUnitSelections(unit: PermissionUnit, selectedKeys: Set<string>) {
  let count = 0;

  for (const control of unit.standardControls) {
    if (isControlChecked(control, selectedKeys)) count += 1;
  }

  for (const permission of unit.advancedPermissions) {
    if (selectedKeys.has(permission.key)) count += 1;
  }

  if (unit.isDerived && isWochenplannerAvailable(selectedKeys)) {
    count += 1;
  }

  return count;
}

function sectionSelectionCount(
  section: PermissionPresentationSection,
  selectedKeys: Set<string>,
) {
  return section.units.reduce(
    (sum, unit) => sum + countUnitSelections(unit, selectedKeys),
    0,
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
      <span className="flex h-8 items-center justify-center text-xs text-[var(--muted)]">
        —
      </span>
    );
  }

  const checked = isControlChecked(control, selectedKeys);
  const locked = control.permissionKeys.every((key) => lockedKeys.has(key));
  const id = `${unit.id}-${control.kind}`;

  return (
    <div className="flex h-8 items-center justify-center">
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

function AdvancedPermissions({
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
  if (unit.advancedPermissions.length === 0) return null;

  const selectedCount = unit.advancedPermissions.filter((permission) =>
    selectedKeys.has(permission.key),
  ).length;

  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-[var(--text-2)] transition-colors hover:text-[var(--foreground)]">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        Erweiterte Rechte
        {selectedCount > 0 ? (
          <span className="rounded-full bg-[var(--sce-primary)]/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--sce-primary)]">
            {selectedCount}
          </span>
        ) : null}
      </summary>

      <div className="mt-3 space-y-2 border-l border-[var(--border)] pl-4">
        {unit.advancedPermissions.map((advanced) => {
          const id = `advanced-${unit.id}-${advanced.key}`;
          const checked = selectedKeys.has(advanced.key);
          const locked = lockedKeys.has(advanced.key);

          return (
            <div
              key={advanced.key}
              className={cn(
                "flex items-start justify-between gap-4 rounded-lg px-3 py-2.5",
                advanced.dangerous && checked
                  ? "bg-amber-500/5"
                  : "bg-[var(--surface-2)]/45",
                disabled || locked ? "opacity-50" : "",
              )}
            >
              <div className="min-w-0">
                <label
                  htmlFor={id}
                  className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold text-[var(--foreground)]"
                >
                  {advanced.label}
                  {advanced.dangerous ? (
                    <span className="inline-flex items-center gap-1 text-[0.62rem] font-semibold text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      Kritisch
                    </span>
                  ) : null}
                </label>

                <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-[var(--muted)]">
                  {advanced.description}
                </p>
              </div>

              <SwitchThumb
                id={id}
                checked={checked}
                disabled={disabled || locked}
                onChange={(nextChecked) =>
                  onChange(
                    togglePermissionKey(
                      selectedKeys,
                      advanced.key,
                      nextChecked,
                    ),
                  )
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
  const viewControl = unit.standardControls.find(
    (control) => control.kind === "view",
  );
  const manageControl = unit.standardControls.find(
    (control) => control.kind === "manage",
  );

  const selectedCount = countUnitSelections(unit, selectedKeys);
  const derivedAvailable =
    unit.isDerived && isWochenplannerAvailable(selectedKeys);

  return (
    <div
      className={cn(
        "border-t border-[var(--border)] px-4 py-3.5 first:border-t-0 sm:px-5",
        selectedCount > 0 ? "bg-[var(--sce-primary)]/[0.025]" : "",
      )}
    >
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {unit.label}
            </p>

            {selectedCount > 0 ? (
              <span className="rounded-full bg-[var(--sce-primary)]/10 px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--sce-primary)]">
                Aktiv
              </span>
            ) : null}
          </div>

          {unit.childLabels && unit.childLabels.length > 0 ? (
            <p className="mt-0.5 text-xs text-[var(--text-2)]">
              {unit.childLabels.join(" · ")}
            </p>
          ) : unit.parentLabel ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {unit.parentLabel}
            </p>
          ) : null}

          {unit.sharedNote ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {unit.sharedNote}
            </p>
          ) : null}

          {unit.isDerived ? (
            <p
              className={cn(
                "mt-2 text-xs",
                derivedAvailable
                  ? "font-medium text-emerald-700"
                  : "text-[var(--muted)]",
              )}
            >
              {derivedAvailable ? "Automatisch verfügbar" : "Noch nicht verfügbar"}
              {unit.derivedNote ? ` · ${unit.derivedNote}` : ""}
            </p>
          ) : null}

          {!unit.isDerived && unit.advancedPermissions.length > 0 ? (
            <div className="mt-2.5">
              <AdvancedPermissions
                unit={unit}
                selectedKeys={selectedKeys}
                lockedKeys={lockedKeys}
                disabled={disabled}
                onChange={onChange}
              />
            </div>
          ) : null}
        </div>

        {!unit.isDerived ? (
          <>
            <div className="hidden sm:block">
              <InlineControl
                unit={unit}
                control={viewControl}
                selectedKeys={selectedKeys}
                lockedKeys={lockedKeys}
                disabled={disabled}
                onChange={onChange}
              />
            </div>

            <div className="hidden sm:block">
              <InlineControl
                unit={unit}
                control={manageControl}
                selectedKeys={selectedKeys}
                lockedKeys={lockedKeys}
                disabled={disabled}
                onChange={onChange}
              />
            </div>

            <div className="space-y-2 sm:hidden">
              <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  Ansehen
                </span>
                <InlineControl
                  unit={unit}
                  control={viewControl}
                  selectedKeys={selectedKeys}
                  lockedKeys={lockedKeys}
                  disabled={disabled}
                  onChange={onChange}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  Verwalten
                </span>
                <InlineControl
                  unit={unit}
                  control={manageControl}
                  selectedKeys={selectedKeys}
                  lockedKeys={lockedKeys}
                  disabled={disabled}
                  onChange={onChange}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>
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
}: {
  section: PermissionPresentationSection;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const selectionCount = sectionSelectionCount(section, selectedKeys);
  const meta = SECTION_META[section.label] ?? {
    description: "Zugriff auf diesen Bereich des Vereins.",
    icon: ShieldCheck,
  };
  const Icon = meta.icon;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-[var(--surface)] transition-colors",
        selectionCount > 0
          ? "border-[var(--sce-primary)]/35"
          : "border-[var(--border)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-4 px-4 py-4 text-left sm:px-5"
        aria-expanded={open}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            selectionCount > 0
              ? "bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]"
              : "bg-[var(--surface-2)] text-[var(--text-2)]",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {section.label}
            </span>

            {selectionCount > 0 ? (
              <span className="rounded-full bg-[var(--sce-primary)]/10 px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--sce-primary)]">
                {selectionCount} aktiv
              </span>
            ) : null}
          </span>

          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {meta.description}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>

      {open ? (
        <div className="border-t border-[var(--border)]">
          <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center bg-[var(--surface-2)]/45 px-5 py-2 sm:grid">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Modul
            </span>
            <span className="text-center text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Ansehen
            </span>
            <span className="text-center text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Verwalten
            </span>
          </div>

          {section.units.map((unit) => (
            <PermissionUnitRow
              key={unit.id}
              unit={unit}
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

export default function NavAlignedPermissionEditor({
  moduleGroups,
  selectedKeys,
  lockedKeys = new Set(),
  onChange,
  disabled = false,
}: NavAlignedPermissionEditorProps) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4 px-1 pb-1">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Module & Berechtigungen
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Lege fest, welche Bereiche diese Rolle ansehen oder verwalten darf.
          </p>
        </div>

        <div className="hidden grid-cols-2 gap-4 text-center sm:grid">
          <span className="w-[5.5rem] text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Ansehen
          </span>
          <span className="w-[5.5rem] text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Verwalten
          </span>
        </div>
      </div>

      {presentation.sections.map((section, index) => (
        <PermissionSection
          key={section.key}
          section={section}
          selectedKeys={selectedKeys}
          lockedKeys={lockedKeys}
          disabled={disabled}
          onChange={onChange}
          defaultOpen={index === 0}
        />
      ))}

      {presentation.supplementalUnit ? (
        <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Weitere Berechtigungen
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Technische oder noch keinem Navigationsbereich zugeordnete Rechte.
          </p>

          <div className="mt-3 border-t border-[var(--border)]">
            <PermissionUnitRow
              unit={presentation.supplementalUnit}
              selectedKeys={selectedKeys}
              lockedKeys={lockedKeys}
              disabled={disabled}
              onChange={onChange}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

export { buildNavPermissionPresentationFromModuleGroups };