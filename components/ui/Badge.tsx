import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1",
    "rounded-full whitespace-nowrap font-medium",
    "leading-none",
  ],
  {
    variants: {
      variant: {
        default:   "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]",
        primary:   "bg-[var(--sce-primary-light)] text-[var(--sce-primary)]",
        secondary: "bg-[var(--sce-secondary-light)] text-[var(--sce-secondary)]",
        success:   "bg-[var(--sce-success-light)] text-[var(--sce-success)]",
        warning:   "bg-[var(--sce-warning-light)] text-[var(--sce-warning)]",
        danger:    "bg-[var(--sce-danger-light)] text-[var(--sce-danger)]",
        info:      "bg-[var(--sce-info-light)] text-[var(--sce-info)]",
        outline:   "border border-[var(--border-strong)] bg-transparent text-[var(--text-2)]",
      },
      size: {
        sm:      "h-5 px-2 text-[0.68rem]",
        default: "h-6 px-2.5 text-xs",
        lg:      "h-7 px-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
export type BadgeSize    = NonNullable<VariantProps<typeof badgeVariants>["size"]>;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

/**
 * Badge
 *
 * SportClubEvo Design System primitive.
 * Semantic pill label for statuses, categories, and counts.
 * Built with class-variance-authority — use `variant` and `size` props.
 *
 * Usage:
 *   <Badge variant="success">Active</Badge>
 *   <Badge variant="danger" size="sm">Overdue</Badge>
 *   <Badge variant="outline">Draft</Badge>
 */
export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}
