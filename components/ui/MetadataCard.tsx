import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/page";
import { cn } from "@/lib/cn";

export type MetaField = {
  label: string;
  value: ReactNode;
};

type MetadataCardProps = {
  /** Metadata label/value pairs to display. */
  fields: MetaField[];
  /** Card section title. Defaults to "Systemdaten". */
  title?: string;
  className?: string;
};

/**
 * MetadataCard
 *
 * SportClubEvo Design System primitive.
 * A `SectionCard` pre-configured for displaying audit/metadata fields such as
 * created-at, updated-at, status, owner, and visibility in the detail sidebar.
 *
 * Usage:
 *   <MetadataCard
 *     fields={[
 *       { label: "Erstellt", value: formatDate(entity.createdAt) },
 *       { label: "Zuletzt geändert", value: formatDate(entity.updatedAt) },
 *     ]}
 *   />
 */
export function MetadataCard({
  fields,
  title = "Systemdaten",
  className,
}: MetadataCardProps) {
  return (
    <SectionCard title={title} className={cn(className)}>
      <dl className="space-y-3">
        {fields.map((field, idx) => (
          <div key={idx}>
            <dt className="text-xs font-medium text-[var(--muted)]">
              {field.label}
            </dt>
            <dd className="mt-0.5 text-sm text-[var(--foreground)]">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
