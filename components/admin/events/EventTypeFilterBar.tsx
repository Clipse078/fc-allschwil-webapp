"use client";

import Link from "next/link";

type EventTypeFilter = "ALL" | "MATCH" | "TOURNAMENT" | "TRAINING" | "OTHER";

type EventTypeFilterBarProps = {
  activeFilter: EventTypeFilter;
};

const FILTERS: Array<{
  key: EventTypeFilter;
  label: string;
}> = [
  { key: "ALL", label: "Alle Events" },
  { key: "MATCH", label: "Matches" },
  { key: "TOURNAMENT", label: "Turniere" },
  { key: "TRAINING", label: "Trainings" },
  { key: "OTHER", label: "Weitere Events" },
];

export default function EventTypeFilterBar({
  activeFilter,
}: EventTypeFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = filter.key === activeFilter;
        const href =
          filter.key === "ALL"
            ? "/dashboard/events"
            : "/dashboard/events?type=" + filter.key;

        return (
          <Link
            key={filter.key}
            href={href}
            className={
              isActive
                ? "inline-flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--blue-light)] px-3 text-xs font-semibold text-[var(--blue)]"
                : "inline-flex h-8 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            }
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
