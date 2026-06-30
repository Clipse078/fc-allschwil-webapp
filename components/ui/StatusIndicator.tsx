import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const dotVariants = cva(
  "inline-block shrink-0 rounded-full",
  {
    variants: {
      variant: {
        default:  "bg-[var(--muted)]",
        success:  "bg-[var(--sce-success)]",
        warning:  "bg-[var(--sce-warning)]",
        danger:   "bg-[var(--sce-danger)]",
        info:     "bg-[var(--sce-info)]",
        neutral:  "bg-[var(--border-strong)]",
      },
      size: {
        sm:      "h-1.5 w-1.5",
        default: "h-2 w-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  },
);

const labelVariants = cva(
  "font-medium leading-none",
  {
    variants: {
      variant: {
        default:  "text-[var(--text-2)]",
        success:  "text-[var(--sce-success)]",
        warning:  "text-[var(--sce-warning)]",
        danger:   "text-[var(--sce-danger)]",
        info:     "text-[var(--sce-info)]",
        neutral:  "text-[var(--muted)]",
      },
      size: {
        sm:      "text-xs",
        default: "text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  },
);

export type StatusIndicatorVariant = NonNullable<VariantProps<typeof dotVariants>["variant"]>;
export type StatusIndicatorSize    = NonNullable<VariantProps<typeof dotVariants>["size"]>;

export type StatusIndicatorProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof dotVariants> & {
    /** Text label rendered beside the status dot. */
    label?: string;
    /** Show the coloured dot. @default true */
    dot?: boolean;
  };

/**
 * StatusIndicator
 *
 * A coloured dot + optional text label that communicates state at a glance.
 * Variants map directly to the SCE semantic token palette.
 *
 * Usage:
 *   <StatusIndicator variant="success" label="Aktiv" />
 *   <StatusIndicator variant="danger" label="Gesperrt" size="sm" />
 *   <StatusIndicator variant="warning" dot={false} label="Ausstehend" />
 */
export function StatusIndicator({
  variant,
  size,
  label,
  dot = true,
  className,
  ...props
}: StatusIndicatorProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      {dot && (
        <span
          className={dotVariants({ variant, size })}
          aria-hidden="true"
        />
      )}
      {label && (
        <span className={labelVariants({ variant, size })}>{label}</span>
      )}
    </span>
  );
}
