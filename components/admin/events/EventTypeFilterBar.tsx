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
                ? "inline-flex items-center rounded-full border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-2 text-sm font-semibold text-[#0b4aa2] shadow-sm"
                : "inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            }
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}