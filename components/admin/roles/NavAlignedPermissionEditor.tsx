"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import {
  buildNavPermissionPresentationFromModuleGroups,
  isControlChecked,
  isControlPartiallyChecked,
  isWochenplannerAvailable,
  togglePermissionKey,
  toggleStandardControl,
  type NavPermissionPresentation,
  type PermissionUnit,
  type StandardControl,
} from "@/lib/roles/nav-permission-presentation";
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

function PermissionCheckbox({
  id,
  label,
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--surface-2)]",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = Boolean(indeterminate);
        }}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--sce-primary)] disabled:cursor-not-allowed"
      />
      <span className="font-medium text-[var(--foreground)]">{label}</span>
    </label>
  );
}

function StandardControlsRow({
  unit,
  control,
  selectedKeys,
  lockedKeys,
  disabled,
  onChange,
}: {
  unit: PermissionUnit;
  control: StandardControl;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
}) {
  const checked = isControlChecked(control, selectedKeys);
  const partial = isControlPartiallyChecked(control, selectedKeys);
  const isLocked = control.permissionKeys.every((key) => lockedKeys.has(key));
  const controlId = `${unit.id}-${control.kind}`;

  return (
    <PermissionCheckbox
      id={controlId}
      label={control.label}
      checked={checked}
      indeterminate={partial}
      disabled={disabled || isLocked}
      onChange={(nextChecked) => onChange(toggleStandardControl(selectedKeys, control, nextChecked))}
    />
  );
}

function PermissionUnitCard({
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
  const hasSelection =
    unit.standardControls.some((control) => isControlChecked(control, selectedKeys)) ||
    unit.advancedPermissions.some((advanced) => selectedKeys.has(advanced.key));

  const derivedAvailable = unit.isDerived && isWochenplannerAvailable(selectedKeys);

  return (
    <div
      className={cn(
        "rounded-xl border bg-[var(--surface)] px-4 py-3.5",
        hasSelection || derivedAvailable
          ? "border-[var(--sce-primary)]/30"
          : "border-[var(--border)]",
      )}
    >
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">{unit.label}</p>
          {unit.parentLabel ? (
            <p className="text-xs text-[var(--muted)]">{unit.parentLabel}</p>
          ) : null}
          {unit.childLabels && unit.childLabels.length > 0 ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">
              {unit.childLabels.join(" · ")}
            </p>
          ) : null}
        </div>

        {unit.sharedNote ? (
          <p className="text-xs leading-relaxed text-[var(--text-2)]">{unit.sharedNote}</p>
        ) : null}

        {unit.isDerived ? (
          <p
            className={cn(
              "text-xs font-medium",
              derivedAvailable ? "text-emerald-700" : "text-[var(--muted)]",
            )}
          >
            {derivedAvailable ? "Verfügbar" : "Nicht verfügbar"} — {unit.derivedNote}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {unit.standardControls.map((control) => (
              <StandardControlsRow
                key={`${unit.id}-${control.kind}`}
                unit={unit}
                control={control}
                selectedKeys={selectedKeys}
                lockedKeys={lockedKeys}
                disabled={disabled}
                onChange={onChange}
              />
            ))}
          </div>
        )}

        {unit.advancedPermissions.length > 0 ? (
          <details className="group mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--text-2)]">
              Erweiterte Berechtigungen
              {unit.advancedPermissions.some((advanced) => selectedKeys.has(advanced.key)) ? (
                <span className="ml-2 text-[var(--sce-primary)]">· aktiv</span>
              ) : null}
            </summary>
            <div className="space-y-2 border-t border-[var(--border)] px-3 py-3">
              {unit.advancedPermissions.map((advanced) => (
                <label
                  key={advanced.key}
                  htmlFor={`advanced-${unit.id}-${advanced.key}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
                    advanced.dangerous && selectedKeys.has(advanced.key)
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-[var(--border)] bg-[var(--surface)]",
                    lockedKeys.has(advanced.key) ? "cursor-not-allowed opacity-50" : "",
                  )}
                >
                  <input
                    id={`advanced-${unit.id}-${advanced.key}`}
                    type="checkbox"
                    checked={selectedKeys.has(advanced.key)}
                    disabled={disabled || lockedKeys.has(advanced.key)}
                    onChange={(e) =>
                      onChange(togglePermissionKey(selectedKeys, advanced.key, e.target.checked))
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--sce-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                      {advanced.label}
                      {advanced.dangerous ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          Dauerhaft löschen
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-2)]">
                      {advanced.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function PermissionSectionBlock({
  presentation,
  sectionKey,
  selectedKeys,
  lockedKeys,
  disabled,
  onChange,
}: {
  presentation: NavPermissionPresentation;
  sectionKey: string;
  selectedKeys: Set<string>;
  lockedKeys: Set<string>;
  disabled: boolean;
  onChange: (next: Set<string>) => void;
}) {
  const section = presentation.sections.find((entry) => entry.key === sectionKey);
  if (!section || section.units.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {section.label}
      </h3>
      <div className="space-y-2.5">
        {section.units.map((unit) => (
          <PermissionUnitCard
            key={unit.id}
            unit={unit}
            selectedKeys={selectedKeys}
            lockedKeys={lockedKeys}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Navigation-aligned permission editor derived from NAV_SECTIONS.
 * Shared by tenant role creation and editing flows.
 */
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
    <div className="space-y-6">
      {presentation.sections.map((section) => (
        <PermissionSectionBlock
          key={section.key}
          presentation={presentation}
          sectionKey={section.key}
          selectedKeys={selectedKeys}
          lockedKeys={lockedKeys}
          disabled={disabled}
          onChange={onChange}
        />
      ))}

      {presentation.supplementalUnit ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Weitere Berechtigungen
          </h3>
          <PermissionUnitCard
            unit={presentation.supplementalUnit}
            selectedKeys={selectedKeys}
            lockedKeys={lockedKeys}
            disabled={disabled}
            onChange={onChange}
          />
        </section>
      ) : null}
    </div>
  );
}

export { buildNavPermissionPresentationFromModuleGroups };
