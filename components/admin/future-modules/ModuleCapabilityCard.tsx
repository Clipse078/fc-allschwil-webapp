import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type ModuleCapabilityCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  status: "Verfügbar" | "In Arbeit" | "Demnächst";
  details?: string[];
  href?: string;
  linkLabel?: string;
};

const statusVariant = {
  Verfügbar: "success",
  "In Arbeit": "warning",
  Demnächst: "default",
} as const;

export function ModuleCapabilityCard({
  title,
  description,
  icon: Icon,
  status,
  details = [],
  href,
  linkLabel,
}: ModuleCapabilityCardProps) {
  const isAvailable = status === "Verfügbar";

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border bg-[var(--surface)] shadow-[var(--shadow-xs)]",
        isAvailable
          ? "border-[var(--sce-primary)]"
          : "border-[var(--border)]",
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              isAvailable
                ? "bg-[var(--sce-primary-light)] text-[var(--sce-primary)]"
                : "bg-[var(--surface)] text-[var(--muted)]",
            )}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        </div>
        <Badge variant={statusVariant[status]} size="sm">
          {status}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col px-5 py-4">
        <p className="text-sm leading-6 text-[var(--text-2)]">{description}</p>

        {details.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`Geplanter Umfang: ${title}`}>
            {details.map((detail) => (
              <li
                key={detail}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[0.68rem] font-medium text-[var(--text-2)]"
              >
                {detail}
              </li>
            ))}
          </ul>
        ) : null}

        {href && linkLabel ? (
          <div className="mt-auto pt-5">
            <Link
              href={href}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--sce-primary)] px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
            >
              {linkLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <p className="mt-auto pt-5 text-[0.7rem] font-medium text-[var(--muted)]">
            Vorschau · Keine Datenspeicherung
          </p>
        )}
      </div>
    </article>
  );
}
