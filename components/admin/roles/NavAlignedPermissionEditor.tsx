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
    description: "Inhalte, News und Website-Verwaltung.",
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

function PermissionUnitIcon({
  unit,
  active,
}: {
  unit: PermissionUnit;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        active
          ? "bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]"
          : "bg-[var(--surface-2)] text-[var(--text-2)]",
      )}
    >
      <AnimatedNavIcon
        label={unit.iconLabel}
        variant="child"
        active={active}
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
      <span className="flex h-8 items-center justify-center text-sm text-[var(--muted)]/60">
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
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.7rem] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text-2)]">
        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
        Erweiterte Rechte
        {selectedCount > 0 ? (
          <span className="text-[var(--sce-primary)]">({selectedCount})</span>
        ) : null}
      </summary>

      <div className="mt-2 space-y-1 border-l border-[var(--border)] pl-3">
        {unit.advancedPermissions.map((advanced) => {
          const id = `advanced-${unit.id}-${advanced.key}`;
          const checked = selectedKeys.has(advanced.key);
          const locked = lockedKeys.has(advanced.key);

          return (
            <div
              key={advanced.key}
              className={cn(
                "flex items-center justify-between gap-3 py-1.5",
                disabled || locked ? "opacity-50" : "",
              )}
            >
              <div className="min-w-0">
                <label
                  htmlFor={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 text-xs font-medium",
                    advanced.dangerous && checked
                      ? "text-amber-800"
                      : "text-[var(--foreground)]",
                  )}
                >
                  {advanced.label}
                  {advanced.dangerous ? (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
                  ) : null}
                </label>
                {advanced.description ? (
                  <p className="mt-0.5 text-[0.68rem] leading-snug text-[var(--muted)]">
                    {advanced.description}
                  </p>
                ) : null}
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
  hideLabel = false,
}: {
  unit: PermissionUnit;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
  hideLabel?: boolean;
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
        "grid items-center gap-x-3 gap-y-2 border-b border-[var(--border)] px-4 py-3 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_5rem_5rem] sm:px-5",
        selectedCount > 0 ? "bg-[var(--sce-primary)]/[0.02]" : "",
      )}
    >
      <div className="hidden sm:block">
        <PermissionUnitIcon unit={unit} active={selectedCount > 0} />
      </div>

      <div className="min-w-0 sm:col-start-2">
        <div className="flex items-start gap-2.5 sm:gap-0">
          <span className="sm:hidden">
            <PermissionUnitIcon unit={unit} active={selectedCount > 0} />
          </span>

          <div className="min-w-0">
            {!hideLabel ? (
              <p className="text-sm font-medium text-[var(--foreground)]">
                {unit.label}
              </p>
            ) : null}

            {unit.description && !hideLabel ? (
              <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
                {unit.description}
              </p>
            ) : hideLabel && unit.description ? (
              <p className="text-xs leading-snug text-[var(--muted)]">
                {unit.description}
              </p>
            ) : null}

            {unit.isDerived ? (
              <p
                className={cn(
                  "mt-1 text-xs",
                  derivedAvailable
                    ? "font-medium text-emerald-700"
                    : "text-[var(--muted)]",
                )}
              >
                {derivedAvailable ? "Automatisch verfügbar" : "Noch nicht verfügbar"}
                {unit.derivedNote ? ` — ${unit.derivedNote}` : ""}
              </p>
            ) : null}

            {!unit.isDerived && unit.advancedPermissions.length > 0 ? (
              <AdvancedPermissions
                unit={unit}
                selectedKeys={selectedKeys}
                lockedKeys={lockedKeys}
                disabled={disabled}
                onChange={onChange}
              />
            ) : null}
          </div>
        </div>
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

          <div className="col-span-full space-y-1.5 sm:hidden">
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
          </div>
        </>
      ) : null}
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
        "overflow-hidden rounded-xl border bg-[var(--surface)] transition-colors",
        selectionCount > 0
          ? "border-[var(--sce-primary)]/25"
          : "border-[var(--border)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5",
          selectionCount > 0 ? "bg-[var(--sce-primary)]/[0.03]" : "",
        )}
        aria-expanded={open}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            selectionCount > 0
              ? "bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]"
              : "bg-[var(--surface-2)] text-[var(--text-2)]",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {section.label}
            </span>

            {selectionCount > 0 ? (
              <span className="rounded-full bg-[var(--sce-primary)]/10 px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--sce-primary)]">
                {selectionCount}
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
          <div className="hidden grid-cols-[2rem_minmax(0,1fr)_5rem_5rem] items-center gap-x-3 border-b border-[var(--border)] bg-[var(--surface-2)]/35 px-5 py-2 sm:grid">
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
    <details className="group rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-left sm:px-5">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
        <span className="text-xs font-medium text-[var(--text-2)]">
          Weitere Zugriffsrechte
        </span>
        {selectionCount > 0 ? (
          <span className="rounded-full bg-[var(--sce-primary)]/10 px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--sce-primary)]">
            {selectionCount}
          </span>
        ) : null}
      </summary>

      <div className="border-t border-[var(--border)]">
        <PermissionUnitRow
          unit={unit}
          selectedKeys={selectedKeys}
          lockedKeys={lockedKeys}
          disabled={disabled}
          onChange={onChange}
          hideLabel
        />
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
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-4 px-1 pb-0.5">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Module & Berechtigungen
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Entspricht der SCE-Navigation — Ansehen und Verwalten pro Modul.
          </p>
        </div>

        <div className="hidden grid-cols-2 gap-4 text-center sm:grid">
          <span className="w-[5rem] text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Ansehen
          </span>
          <span className="w-[5rem] text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Verwalten
          </span>
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
