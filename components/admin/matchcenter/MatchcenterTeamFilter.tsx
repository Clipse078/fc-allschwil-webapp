"use client";

import { useMemo, useRef, useState, type FocusEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Users, X } from "lucide-react";
import {
  buildMatchcenterHref,
  type MatchcenterTeamOption,
} from "@/lib/matchcenter/navigation";
import type {
  MatchcenterActionFilter,
  MatchcenterTab,
  MatchcenterWochenplanFilter,
} from "@/lib/matchcenter/view-model";
import { cn } from "@/lib/cn";

const SEARCH_THRESHOLD = 10;

type MatchcenterTeamFilterProps = {
  teams: MatchcenterTeamOption[];
  teamFilter: string | null;
  basePath: string;
  tab: MatchcenterTab;
  month: string;
  actionFilter: MatchcenterActionFilter;
  wochenplanFilter: MatchcenterWochenplanFilter;
};

export default function MatchcenterTeamFilter({
  teams,
  teamFilter,
  basePath,
  tab,
  month,
  actionFilter,
  wochenplanFilter,
}: MatchcenterTeamFilterProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentLabel =
    teams.find((team) => team.id === teamFilter)?.label ?? "Alle Teams";

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return teams;
    }

    return teams.filter((team) => team.label.toLowerCase().includes(query));
  }, [search, teams]);

  function hrefForTeam(nextTeamFilter: string | null) {
    return buildMatchcenterHref(basePath, {
      tab,
      month,
      actionFilter,
      wochenplanFilter,
      teamFilter: nextTeamFilter,
    });
  }

  function selectTeam(nextTeamFilter: string | null) {
    setOpen(false);
    setSearch("");
    router.push(hrefForTeam(nextTeamFilter));
  }

  function handleTriggerBlur(event: FocusEvent<HTMLButtonElement>) {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && containerRef.current?.contains(nextTarget)) {
      return;
    }

    window.setTimeout(() => setOpen(false), 150);
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      data-testid="matchcenter-team-filter"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onBlur={handleTriggerBlur}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
          teamFilter
            ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10 text-[var(--tenant-primary)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Team filtern"
        data-testid="matchcenter-team-filter-trigger"
      >
        <Users className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="max-w-[160px] truncate">{currentLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        {teamFilter ? (
          <span
            role="button"
            tabIndex={0}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              selectTeam(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                selectTeam(null);
              }
            }}
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full hover:bg-[var(--tenant-primary)]/20"
            aria-label="Teamfilter entfernen"
            data-testid="matchcenter-team-filter-clear"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Teams"
          className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,240px)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
          data-testid="matchcenter-team-filter-menu"
        >
          {teams.length >= SEARCH_THRESHOLD ? (
            <div className="border-b border-[var(--border)] p-2">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Team suchen…"
                className="fca-input h-8 w-full text-xs"
                data-testid="matchcenter-team-filter-search"
              />
            </div>
          ) : null}

          <ul className="max-h-64 overflow-y-auto py-1">
            <li role="option" aria-selected={!teamFilter}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectTeam(null)}
                className={cn(
                  "flex w-full items-start px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-2)]",
                  !teamFilter && "bg-[var(--surface-2)] font-semibold",
                )}
                data-testid="matchcenter-team-filter-all"
              >
                Alle Teams
              </button>
            </li>
            {filteredTeams.map((team) => (
              <li
                key={team.id}
                role="option"
                aria-selected={teamFilter === team.id}
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectTeam(team.id)}
                  className={cn(
                    "flex w-full items-start px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-2)]",
                    teamFilter === team.id && "bg-[var(--surface-2)] font-semibold",
                  )}
                  data-testid={`matchcenter-team-filter-option-${team.id}`}
                >
                  {team.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
