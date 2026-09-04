/**
 * Section-level presentation metadata for nav-aligned permission editors.
 * Presentation only — does not affect authorization semantics.
 */

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Compass,
  Globe2,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type {
  PermissionPresentationSection,
  PermissionUnit,
} from "@/lib/roles/nav-permission-presentation";
import { isControlChecked, isWochenplannerAvailable } from "@/lib/roles/nav-permission-presentation";

export type PermissionSectionKey =
  | "Organisation"
  | "Website"
  | "Betrieb"
  | "Führung"
  | "System";

export type PermissionSectionStatus = "active" | "partial" | "inactive";

export type PermissionSectionAccent = {
  key: PermissionSectionKey;
  label: PermissionSectionKey;
  description: string;
  icon: LucideIcon;
  /** Restrained accent for icons, dots, and tinted surfaces */
  accent: string;
  accentMuted: string;
  accentSurface: string;
  accentBorder: string;
};

export const PERMISSION_SECTION_ACCENTS: Record<PermissionSectionKey, PermissionSectionAccent> = {
  Organisation: {
    key: "Organisation",
    label: "Organisation",
    description: "Vereinsstruktur, Teams, Personen und sportliche Organisation.",
    icon: Building2,
    accent: "rgb(99 130 246)",
    accentMuted: "color-mix(in srgb, rgb(99 130 246) 65%, var(--muted))",
    accentSurface: "color-mix(in srgb, rgb(99 130 246) 8%, var(--surface))",
    accentBorder: "color-mix(in srgb, rgb(99 130 246) 22%, var(--border))",
  },
  Website: {
    key: "Website",
    label: "Website",
    description: "Inhalte, News und Website-Verwaltung.",
    icon: Globe2,
    accent: "rgb(52 211 153)",
    accentMuted: "color-mix(in srgb, rgb(52 211 153) 65%, var(--muted))",
    accentSurface: "color-mix(in srgb, rgb(52 211 153) 8%, var(--surface))",
    accentBorder: "color-mix(in srgb, rgb(52 211 153) 22%, var(--border))",
  },
  Betrieb: {
    key: "Betrieb",
    label: "Betrieb",
    description: "Training, Spielbetrieb, Wochenplanung und operative Abläufe.",
    icon: Compass,
    accent: "rgb(167 139 250)",
    accentMuted: "color-mix(in srgb, rgb(167 139 250) 65%, var(--muted))",
    accentSurface: "color-mix(in srgb, rgb(167 139 250) 8%, var(--surface))",
    accentBorder: "color-mix(in srgb, rgb(167 139 250) 22%, var(--border))",
  },
  Führung: {
    key: "Führung",
    label: "Führung",
    description: "Führungs- und Steuerungsbereiche des Vereins.",
    icon: ShieldCheck,
    accent: "rgb(251 191 36)",
    accentMuted: "color-mix(in srgb, rgb(251 191 36) 65%, var(--muted))",
    accentSurface: "color-mix(in srgb, rgb(251 191 36) 8%, var(--surface))",
    accentBorder: "color-mix(in srgb, rgb(251 191 36) 22%, var(--border))",
  },
  System: {
    key: "System",
    label: "System",
    description: "Administration, Zugänge, Rollen und Systemeinstellungen.",
    icon: Settings2,
    accent: "rgb(148 163 184)",
    accentMuted: "color-mix(in srgb, rgb(148 163 184) 65%, var(--muted))",
    accentSurface: "color-mix(in srgb, rgb(148 163 184) 8%, var(--surface))",
    accentBorder: "color-mix(in srgb, rgb(148 163 184) 22%, var(--border))",
  },
};

export function getPermissionSectionAccent(
  sectionLabel: string,
): PermissionSectionAccent {
  return (
    PERMISSION_SECTION_ACCENTS[sectionLabel as PermissionSectionKey] ?? {
      key: "System",
      label: sectionLabel as PermissionSectionKey,
      description: "Zugriff auf diesen Bereich des Vereins.",
      icon: Settings2,
      accent: PERMISSION_SECTION_ACCENTS.System.accent,
      accentMuted: PERMISSION_SECTION_ACCENTS.System.accentMuted,
      accentSurface: PERMISSION_SECTION_ACCENTS.System.accentSurface,
      accentBorder: PERMISSION_SECTION_ACCENTS.System.accentBorder,
    }
  );
}

function countUnitStandardControls(unit: PermissionUnit, selectedKeys: Set<string>): {
  total: number;
  selected: number;
} {
  if (unit.isDerived) {
    const available = isWochenplannerAvailable(selectedKeys);
    return { total: 1, selected: available ? 1 : 0 };
  }

  let total = 0;
  let selected = 0;

  for (const control of unit.standardControls) {
    total += 1;
    if (isControlChecked(control, selectedKeys)) selected += 1;
  }

  return { total, selected };
}

export function countSectionModules(section: PermissionPresentationSection): number {
  return section.units.length;
}

export function countSectionStandardControls(
  section: PermissionPresentationSection,
): number {
  return section.units.reduce(
    (sum, unit) => sum + countUnitStandardControls(unit, new Set()).total,
    0,
  );
}

export function countSectionSelectedStandardControls(
  section: PermissionPresentationSection,
  selectedKeys: Set<string>,
): number {
  return section.units.reduce((sum, unit) => {
    const { selected } = countUnitStandardControls(unit, selectedKeys);
    return sum + selected;
  }, 0);
}

export function countSectionActiveModules(
  section: PermissionPresentationSection,
  selectedKeys: Set<string>,
): number {
  return section.units.filter((unit) => {
    const { selected } = countUnitStandardControls(unit, selectedKeys);
    return selected > 0;
  }).length;
}

export function getPermissionSectionStatus(
  section: PermissionPresentationSection,
  selectedKeys: Set<string>,
): PermissionSectionStatus {
  const total = countSectionStandardControls(section);
  const selected = countSectionSelectedStandardControls(section, selectedKeys);

  if (selected === 0) return "inactive";
  if (selected >= total) return "active";
  return "partial";
}

export function getPermissionSectionStatusLabel(
  status: PermissionSectionStatus,
): string {
  switch (status) {
    case "active":
      return "Aktiv";
    case "partial":
      return "Teilweise aktiv";
    case "inactive":
      return "Nicht aktiv";
  }
}

export function countAllGrantableStandardControls(
  sections: PermissionPresentationSection[],
): number {
  return sections.reduce(
    (sum, section) => sum + countSectionStandardControls(section),
    0,
  );
}

export function countAllSelectedStandardControls(
  sections: PermissionPresentationSection[],
  selectedKeys: Set<string>,
): number {
  return sections.reduce(
    (sum, section) => sum + countSectionSelectedStandardControls(section, selectedKeys),
    0,
  );
}

export function countAllActiveModules(
  sections: PermissionPresentationSection[],
  selectedKeys: Set<string>,
): number {
  return sections.reduce(
    (sum, section) => sum + countSectionActiveModules(section, selectedKeys),
    0,
  );
}

export function collectAllGrantableKeys(
  sections: PermissionPresentationSection[],
  supplementalUnit: PermissionUnit | null,
): string[] {
  const keys = new Set<string>();

  for (const section of sections) {
    for (const unit of section.units) {
      for (const control of unit.standardControls) {
        for (const key of control.permissionKeys) keys.add(key);
      }
      for (const advanced of unit.advancedPermissions) keys.add(advanced.key);
    }
  }

  if (supplementalUnit) {
    for (const control of supplementalUnit.standardControls) {
      for (const key of control.permissionKeys) keys.add(key);
    }
    for (const advanced of supplementalUnit.advancedPermissions) keys.add(advanced.key);
  }

  return Array.from(keys);
}

export function isUnitActive(
  unit: PermissionUnit,
  selectedKeys: Set<string>,
): boolean {
  const { selected } = countUnitStandardControls(unit, selectedKeys);
  return selected > 0;
}

export function getUnitAccentForSection(
  sectionLabel: string,
  unit: PermissionUnit,
  selectedKeys: Set<string>,
): { accent: string; accentSurface: string } {
  const sectionAccent = getPermissionSectionAccent(sectionLabel);
  const active = isUnitActive(unit, selectedKeys);

  return {
    accent: active ? sectionAccent.accent : "var(--text-2)",
    accentSurface: active ? sectionAccent.accentSurface : "var(--surface-2)",
  };
}
