"use client";

import { Lightbulb, Shield } from "lucide-react";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { SwitchToggle } from "@/components/ui/SwitchToggle";
import {
  countAllActiveModules,
  countAllGrantableStandardControls,
  countAllSelectedStandardControls,
  countSectionActiveModules,
  countSectionModules,
  getPermissionSectionAccent,
  getPermissionSectionStatus,
  getPermissionSectionStatusLabel,
} from "@/lib/roles/permission-section-presentation";
import type { NavPermissionPresentation } from "@/lib/roles/nav-permission-presentation";
import { cn } from "@/lib/cn";

type RolePermissionPreviewPanelProps = {
  name: string;
  description: string;
  isActive: boolean;
  onActiveChange?: (next: boolean) => void;
  presentation: NavPermissionPresentation;
  selectedKeys: Set<string>;
  showTip?: boolean;
};

export default function RolePermissionPreviewPanel({
  name,
  description,
  isActive,
  onActiveChange,
  presentation,
  selectedKeys,
  showTip = true,
}: RolePermissionPreviewPanelProps) {
  const displayName = name.trim() || "Neue Rolle";
  const totalModules = presentation.sections.reduce(
    (sum, section) => sum + countSectionModules(section),
    0,
  );
  const activeModules = countAllActiveModules(presentation.sections, selectedKeys);
  const totalControls = countAllGrantableStandardControls(presentation.sections);
  const selectedControls = countAllSelectedStandardControls(
    presentation.sections,
    selectedKeys,
  );
  const progressPercent =
    totalControls > 0 ? Math.round((selectedControls / totalControls) * 100) : 0;

  return (
    <div className="space-y-4">
      <SectionCard noPadding bodyClassName="p-0">
        <div className="space-y-4 p-5">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Rolle
            </p>

            <div className="mt-3 flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]"
              >
                <Shield className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {displayName}
                </p>

                {description.trim() ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-2)]">
                    {description.trim()}
                  </p>
                ) : null}

                <span
                  className={cn(
                    "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[0.62rem] font-semibold",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-[var(--surface-2)] text-[var(--muted)]",
                  )}
                >
                  {isActive ? "Aktiv" : "Inaktiv"}
                </span>
              </div>
            </div>
          </div>

          {onActiveChange ? (
            <SwitchToggle
              id="role-preview-is-active"
              label="Rolle ist aktiv"
              checked={isActive}
              onChange={onActiveChange}
            />
          ) : null}
        </div>

        <div className="border-t border-[var(--border)] p-5">
          <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Berechtigungen
          </p>

          <div className="mt-3">
            <p className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">
              {activeModules}
              <span className="text-base font-normal text-[var(--muted)]">
                {" "}
                / {totalModules}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-2)]">Module mit Zugriff</p>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[0.68rem] text-[var(--muted)]">
              <span>Fortschritt</span>
              <span className="tabular-nums">{progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--sce-primary)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {presentation.sections.map((section) => {
              const accent = getPermissionSectionAccent(section.label);
              const status = getPermissionSectionStatus(section, selectedKeys);
              const activeInSection = countSectionActiveModules(section, selectedKeys);
              const totalInSection = countSectionModules(section);

              return (
                <div
                  key={section.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/35 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: accent.accentSurface,
                        color: accent.accent,
                      }}
                    >
                      <accent.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="truncate text-xs font-medium text-[var(--foreground)]">
                      {section.label}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-[var(--text-2)]">
                      {activeInSection} / {totalInSection}
                    </span>
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          status === "inactive" ? "var(--muted)" : accent.accent,
                      }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {showTip ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-[var(--text-2)]">
            <span className="font-medium text-[var(--foreground)]">Tipp:</span>{" "}
            Vergeben Sie nur die Berechtigungen, die für die Rolle wirklich nötig sind.
            Weniger Rechte bedeuten mehr Sicherheit.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export { getPermissionSectionStatusLabel };
