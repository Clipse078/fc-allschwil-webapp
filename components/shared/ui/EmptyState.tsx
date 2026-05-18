import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: "sm" | "md" | "lg";
};

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "md",
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "py-8",
    md: "py-12",
    lg: "py-20",
  };

  const iconSizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${sizeClasses[size]}`}
    >
      {Icon ? (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
          <Icon className={`${iconSizeClasses[size]} text-slate-400`} />
        </div>
      ) : null}

      <p className="font-[var(--font-display)] text-base font-semibold uppercase tracking-wide text-slate-700">
        {title}
      </p>

      {description ? (
        <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}

      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
