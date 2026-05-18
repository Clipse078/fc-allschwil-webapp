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
      classes: "border-slate-200 bg-slate-50 text-slate-500",
      Icon: Eye,
    },
    RESTRICTED: {
      label: "Eingeschränkt",
      classes: "border-amber-200 bg-amber-50 text-amber-700",
      Icon: EyeOff,
    },
    PRIVATE: {
      label: "Privat",
      classes: "border-rose-200 bg-rose-50 text-rose-700",
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
