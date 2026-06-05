"use client";

import { useRouter, usePathname } from "next/navigation";
import { Clock, Filter } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import type { MembershipHistoryItem } from "@/lib/org/queries";

type SeasonOption = { id: string; name: string; key: string; isActive: boolean };

type Props = {
  orgUnitId: string;
  history: MembershipHistoryItem[];
  seasons: SeasonOption[];
  currentSeasonId?: string;
  currentStatus?: string;
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  PENDING: "Ausstehend",
};

const STATUS_OPTIONS = ["", "ACTIVE", "INACTIVE", "PENDING"] as const;

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMemberTitle(m: MembershipHistoryItem): string {
  if (m.user) return `${m.user.firstName} ${m.user.lastName}`;
  if (m.person) return m.person.displayName || `${m.person.firstName} ${m.person.lastName}`;
  if (m.userId) return `User: ${m.userId.substring(0, 8)}…`;
  if (m.personId) return `Person: ${m.personId.substring(0, 8)}…`;
  return "Nicht zugewiesen";
}

function getMemberSubtitle(m: MembershipHistoryItem): string | undefined {
  if (m.user?.email) return m.user.email;
  if (m.person?.email) return m.person.email ?? undefined;
  return undefined;
}

function getPeriod(m: MembershipHistoryItem): string | null {
  const start = formatDate(m.startsAt);
  const end = formatDate(m.endsAt);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Ab ${start}`;
  if (end) return `Bis ${end}`;
  return null;
}

function getStatusTone(status: string): "success" | "warning" | "muted" | "default" {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warning";
  return "muted";
}

export default function OrgMembershipHistoryView({
  orgUnitId: _orgUnitId,
  history,
  seasons,
  currentSeasonId,
  currentStatus,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (key !== "seasonId" && currentSeasonId) params.set("seasonId", currentSeasonId);
    if (key !== "status" && currentStatus) params.set("status", currentStatus);
    if (value) params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    router.push(pathname);
  }

  const hasActiveFilters = !!currentSeasonId || !!currentStatus;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Filter
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-[var(--blue)] transition hover:underline"
            >
              Filter zurücksetzen
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3 px-5 pb-4 pt-3">
          {/* Season filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Saison
            </label>
            <select
              value={currentSeasonId ?? ""}
              onChange={(e) => applyFilter("seasonId", e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
            >
              <option value="">Alle Saisons</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isActive ? " (Aktiv)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Status
            </label>
            <select
              value={currentStatus ?? ""}
              onChange={(e) => applyFilter("status", e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s ? (STATUS_LABELS[s] ?? s) : "Alle Status"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* History list */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Mitgliedschafts-Verlauf
            </p>
            <span className="sce-count-badge">{history.length}</span>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)]">
              <Clock className="h-5 w-5 text-[var(--muted)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Keine Mitgliedschaftseinträge
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {hasActiveFilters
                  ? "Keine Einträge für die gewählten Filter."
                  : "Noch keine Mitgliedschaften vorhanden."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {history.map((m) => {
              const title = getMemberTitle(m);
              const subtitle = getMemberSubtitle(m);
              const period = getPeriod(m);

              return (
                <div key={m.id} className="flex items-start gap-4 px-5 py-4">
                  <AdminAvatar name={title} size="sm" />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Name + member type badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
                      {m.user ? (
                        <span
                          className="sce-role-badge"
                          style={{
                            background: "rgba(11,74,162,0.08)",
                            color: "var(--blue)",
                            border: "1px solid rgba(11,74,162,0.18)",
                          }}
                        >
                          App-Benutzer
                        </span>
                      ) : (
                        <span className="sce-role-badge sce-role-badge-member">Person</span>
                      )}
                    </div>

                    {subtitle ? (
                      <p className="text-xs text-[var(--muted)]">{subtitle}</p>
                    ) : null}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <AdminStatusPill
                        label={STATUS_LABELS[m.status] ?? m.status}
                        tone={getStatusTone(m.status)}
                      />

                      {m.roleKey ? (
                        <span className="sce-role-badge sce-role-badge-staff">{m.roleKey}</span>
                      ) : null}

                      {m.isPrimary ? (
                        <span
                          className="sce-role-badge"
                          style={{
                            background: "rgba(11,74,162,0.10)",
                            color: "var(--blue)",
                            border: "1px solid rgba(11,74,162,0.20)",
                          }}
                        >
                          Primär
                        </span>
                      ) : null}

                      {/* Season badge — Phase A */}
                      {m.season ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                          <Clock className="h-2.5 w-2.5" />
                          {m.season.name}
                        </span>
                      ) : null}

                      {period ? (
                        <span className="text-[11px] text-[var(--muted)]">{period}</span>
                      ) : null}
                    </div>

                    {/* Notes — Phase A */}
                    {m.notes ? (
                      <p className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12px] text-[var(--text-2)]">
                        {m.notes}
                      </p>
                    ) : null}

                    {/* Timestamp */}
                    <p className="text-[11px] text-[var(--muted)]">
                      Erstellt {formatDate(m.createdAt as unknown as Date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
