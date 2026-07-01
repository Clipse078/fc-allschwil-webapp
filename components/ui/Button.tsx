import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5",
    "whitespace-nowrap font-semibold",
    "transition-all duration-[120ms]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "shrink-0 select-none",
  ],
  {
    variants: {
      variant: {
        primary: [
          "rounded-lg border border-transparent",
          "bg-[var(--sce-primary)] text-white",
          "hover:bg-[var(--sce-primary-hover)]",
          "active:scale-[0.98]",
          "focus-visible:ring-[var(--sce-primary)]",
        ],
        secondary: [
          "rounded-lg border border-[var(--border-strong)]",
          "bg-[var(--surface)] text-[var(--text-2)]",
          "hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
          "focus-visible:ring-[var(--border-strong)]",
        ],
        ghost: [
          "rounded-lg border border-transparent",
          "bg-transparent text-[var(--text-2)]",
          "hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
          "focus-visible:ring-[var(--border)]",
        ],
        danger: [
          "rounded-lg border border-transparent",
          "bg-[var(--sce-danger)] text-white",
          "hover:bg-[var(--sce-danger-hover)]",
          "active:scale-[0.98]",
          "focus-visible:ring-[var(--sce-danger)]",
        ],
        link: [
          "border-none rounded-none bg-transparent",
          "text-[var(--sce-primary)]",
          "underline-offset-4 hover:underline",
          "focus-visible:ring-[var(--sce-primary)]",
        ],
      },
      size: {
        sm:      "h-7 px-3 text-xs rounded-md",
        default: "h-9 px-3.5 text-sm",
        lg:      "h-10 px-5 text-sm",
        icon:    "h-9 w-9 p-0 rounded-lg",
      },
    },
    compoundVariants: [
      {
        variant: "link",
        size: ["sm", "default", "lg", "icon"],
        className: "h-auto px-0 py-0",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size:    "default",
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize    = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Show a loading spinner and disable interaction. */
    loading?: boolean;
    /** Icon rendered to the left of the label. */
    iconLeft?: ReactNode;
    /** Icon rendered to the right of the label. */
    iconRight?: ReactNode;
  };

/**
 * Button
 *
 * SportClubEvo Design System primitive.
 * Built with class-variance-authority — use `variant` and `size` props.
 * Supports loading state, icon slots, and all HTML button attributes.
 *
 * Usage:
 *   <Button variant="primary" size="default">Save</Button>
 *   <Button variant="secondary" iconLeft={<Plus />}>Add Team</Button>
 *   <Button variant="danger" loading>Deleting…</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      disabled,
      iconLeft,
      iconRight,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          iconLeft && (
            <span className="inline-flex shrink-0" aria-hidden="true">
              {iconLeft}
            </span>
          )
        )}

        {children}

        {!loading && iconRight && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {iconRight}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
