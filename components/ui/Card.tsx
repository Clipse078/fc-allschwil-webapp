import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const cardVariants = cva(
  [
    "rounded-xl border bg-[var(--surface)] overflow-hidden",
    "transition-[box-shadow,border-color] duration-[120ms]",
  ],
  {
    variants: {
      variant: {
        content: [
          "border-[var(--border)] shadow-sm",
        ],
        metric: [
          "border-[var(--border)] shadow-sm",
        ],
        section: [
          "border-[var(--border)] shadow-sm",
        ],
        sidebar: [
          "border-[var(--border)] shadow-none",
        ],
        inspector: [
          "border-[var(--border)] shadow-sm bg-[var(--surface-2)]",
        ],
        warning: [
          "border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] shadow-none",
        ],
        empty: [
          "border-[var(--border)] border-dashed shadow-none bg-transparent",
        ],
      },
      interactive: {
        true: [
          "cursor-pointer",
          "hover:shadow-md hover:border-[var(--border-strong)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2",
        ],
        false: [],
      },
    },
    defaultVariants: {
      variant: "content",
      interactive: false,
    },
  },
);

export type CardVariant = NonNullable<VariantProps<typeof cardVariants>["variant"]>;

export type CardProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants> & {
    /** Optional card header title. */
    title?: string;
    /** Optional supporting text below the title. */
    description?: string;
    /** Optional slot for header-level actions (right side of header). */
    actions?: ReactNode;
    /** Remove default body padding — useful for full-bleed tables or images. */
    noPadding?: boolean;
    /** Show a left-border accent in the SCE primary color. */
    accent?: boolean;
  };

/**
 * Card
 *
 * SportClubEvo Design System surface primitive.
 * Wraps a logical section in a clean, elevated surface with optional header,
 * description, and actions.
 *
 * Variants: content | metric | section | sidebar | inspector | warning | empty
 *
 * Usage:
 *   <Card title="Team Overview" actions={<Button size="sm">Edit</Button>}>
 *     <p>…content…</p>
 *   </Card>
 *
 *   <Card variant="warning" title="Achtung">…</Card>
 *   <Card variant="metric" noPadding>…</Card>
 *   <Card interactive onClick={() => …}>…</Card>
 */
export function Card({
  variant,
  interactive,
  title,
  description,
  actions,
  noPadding = false,
  accent = false,
  className,
  children,
  ...props
}: CardProps) {
  const hasHeader = !!(title || description || actions);

  return (
    <div
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      className={cn(
        cardVariants({ variant, interactive }),
        accent && "border-l-[3px]",
        className,
      )}
      style={accent ? { borderLeftColor: "var(--sce-primary)" } : undefined}
      {...props}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 px-5 py-4",
            variant !== "empty" && variant !== "warning" && "border-b border-[var(--border)]",
            variant === "warning" && "border-b border-[var(--sce-warning-border)]",
          )}
        >
          <div className="min-w-0 flex-1">
            {title && (
              <h2
                className={cn(
                  "text-sm font-semibold",
                  variant === "warning"
                    ? "text-[var(--sce-warning)]"
                    : "text-[var(--foreground)]",
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  variant === "warning"
                    ? "text-[var(--sce-warning)]"
                    : "text-[var(--text-2)]",
                )}
              >
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}

      {children !== undefined && (
        <div className={cn(!noPadding && "px-5 py-4")}>{children}</div>
      )}
    </div>
  );
}
