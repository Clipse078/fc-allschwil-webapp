import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  /**
   * Icon to display above the heading.
   * Pass a Lucide icon component or any ReactNode.
   * Example: <FolderOpen className="h-10 w-10" />
   */
  icon?: ReactNode;
  /** Short, friendly heading. */
  heading: string;
  /** Optional supporting text with more context. */
  description?: string;
  /** Optional CTA button(s) rendered below the description. */
  action?: ReactNode;
  className?: string;
};

/**
 * EmptyState
 *
 * A centred, minimal placeholder for zero-data scenarios.
 * Used inside tables, lists, or section cards when no records exist.
 * Tenant-branding-ready: icon accent uses `--tenant-primary`.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Users className="h-10 w-10" />}
 *     heading="Keine Teams vorhanden"
 *     description="Erstelle das erste Team für diese Saison."
 *     action={
 *       <button className="sce-btn-primary">Neues Team</button>
 *     }
 *   />
 */
export function EmptyState({
  icon,
  heading,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: "var(--tenant-accent)",
            color: "var(--tenant-primary)",
          }}
        >
          {icon}
        </div>
      )}

      <div className="max-w-sm space-y-1.5">
        <p className="text-sm font-semibold text-[var(--foreground)]">{heading}</p>
        {description && (
          <p className="text-sm text-[var(--text-2)]">{description}</p>
        )}
      </div>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
