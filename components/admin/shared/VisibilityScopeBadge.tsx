import { Eye, EyeOff, Lock } from "lucide-react";
import type { VisibilityScopeValue } from "./VisibilityScopeSelect";

type VisibilityScopeBadgeProps = {
  scope: VisibilityScopeValue;
  /** Only show badge for non-default scopes. */
  hideOrganisation?: boolean;
};

export default function VisibilityScopeBadge({
  scope,
  hideOrganisation = true,
}: VisibilityScopeBadgeProps) {
  if (hideOrganisation && scope === "ORGANISATION") return null;

  const config = {
    ORGANISATION: {
      label: "Organisation",
      classes: "sce-chip",
      Icon: Eye,
    },
    RESTRICTED: {
      label: "Eingeschränkt",
      classes: "sce-chip-warning",
      Icon: EyeOff,
    },
    PRIVATE: {
      label: "Privat",
      classes: "sce-chip-danger",
      Icon: Lock,
    },
  }[scope];

  const { label, classes, Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}
      title={`Sichtbarkeit: ${label}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
