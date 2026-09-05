"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowUpDown,
  Building2,
  Search,
} from "lucide-react";
import TenantStatusBadge from "@/components/admin/tenants/TenantStatusBadge";
import type { TenantRegistryItem } from "@/lib/tenants/platform-ops/queries";
import type { TenantRegistryStatusFilter } from "@/lib/tenants/platform-ops/types";

type TenantRegistryListProps = {
  tenants: TenantRegistryItem[];
  canManage: boolean;
  initialFilter?: TenantRegistryStatusFilter;
};

type SortKey = "name" | "createdAt" | "lastActivityAt" | "status";

const FILTER_OPTIONS: Array<{ value: TenantRegistryStatusFilter; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "active", label: "Aktiv" },
  { value: "onboarding", label: "Onboarding" },
  { value: "suspended", label: "Suspendiert" },
  { value: "attention", label: "Aufmerksamkeit" },
  { value: "archived", label: "Archiviert" },
];

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function TenantRegistryList({
  tenants,
  canManage,
  initialFilter,
}: TenantRegistryListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenantRegistryStatusFilter>(
    initialFilter ?? "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = tenants.filter((tenant) => {
      const matchesQuery =
        !q ||
        tenant.name.toLowerCase().includes(q) ||
        tenant.key.toLowerCase().includes(q);
      const matchesFilter =
        statusFilter === "all"
          ? tenant.status !== "ARCHIVED"
          : statusFilter === "active"
            ? tenant.operationalPhase === "ACTIVE"
            : statusFilter === "onboarding"
              ? tenant.operationalPhase === "ONBOARDING"
              : statusFilter === "suspended"
                ? tenant.operationalPhase === "SUSPENDED"
                : statusFilter === "archived"
                  ? tenant.operationalPhase === "ARCHIVED"
                  : tenant.needsAttention && tenant.status !== "ARCHIVED";
      return matchesQuery && matchesFilter;
    });

    return [...base].sort((a, b) => {
      const direction = sortAsc ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * direction;
      if (sortKey === "status") {
        return a.operationalPhase.localeCompare(b.operationalPhase) * direction;
      }
      const aTime = new Date(
        sortKey === "createdAt" ? a.createdAt : a.lastActivityAt,
      ).getTime();
      const bTime = new Date(
        sortKey === "createdAt" ? b.createdAt : b.lastActivityAt,
      ).getTime();
      return (aTime - bTime) * direction;
    });
  }, [query, sortAsc, sortKey, statusFilter, tenants]);

  async function handleArchive(tenantKey: string, tenantName: string) {
    if (
      !confirm(
        `Tenant "${tenantName}" archivieren? Diese Aktion erfordert einen Grund im Detailbereich.`,
      )
    ) {
      return;
    }
    setArchiving(tenantKey);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantKey}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "archive",
          reason: "Archiviert aus Tenant-Registry",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setArchiveError(data?.error ?? "Archivierung fehlgeschlagen.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setArchiveError("Netzwerkfehler beim Archivieren.");
    } finally {
      setArchiving(null);
    }
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortAsc((value) => !value);
      return;
    }
    setSortKey(nextKey);
    setSortAsc(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="sce-page-search flex-1">
          <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nach Club, Slug oder Domain suchen…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={
                statusFilter === option.value
                  ? "rounded-full border border-[var(--blue)] bg-[var(--blue-light)] px-3 py-1.5 text-xs font-semibold text-[var(--blue)]"
                  : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:border-[var(--border-strong)]"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {archiveError && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {archiveError}
        </div>
      )}

      <div className="sce-detail-section overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Building2 className="h-8 w-8 text-[var(--muted)]" />
            <p className="text-sm font-medium text-[var(--text-2)]">
              {query || statusFilter !== "all"
                ? "Keine Tenants für diese Suche oder Filter."
                : "Noch keine Tenants angelegt."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
                    >
                      Club
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Slug / Domain
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
                    >
                      Status
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Locale
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Admins
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("createdAt")}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
                    >
                      Erstellt
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("lastActivityAt")}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
                    >
                      Letzte Aktivität
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  {canManage && (
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Aktionen
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {tenant.needsAttention && (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-warning)]" />
                        )}
                        <div>
                          <Link
                            href={`/dashboard/admin/tenants/${tenant.key}`}
                            className="font-medium text-[var(--foreground)] hover:text-[var(--blue)] hover:underline"
                          >
                            {tenant.name}
                          </Link>
                          {tenant.attentionItems[0] && (
                            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                              {tenant.attentionItems[0].label}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[0.75rem] text-[var(--text-2)]">
                        {tenant.key}
                      </code>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">
                        {tenant.key}.sportclubevo.app
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <TenantStatusBadge operationalPhase={tenant.operationalPhase} />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-2)]">
                      <div>{tenant.locale ?? "—"}</div>
                      <div className="text-[11px] text-[var(--muted)]">
                        {tenant.countryCode ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          tenant.activeClubAdminCount === 0
                            ? "font-semibold text-[var(--sce-warning)]"
                            : "text-[var(--text-2)]"
                        }
                      >
                        {tenant.activeClubAdminCount}
                      </span>
                      <span className="text-[var(--muted)]"> / {tenant.activeMemberCount}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-2)]">
                      {formatDate(tenant.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-2)]">
                      {formatDate(tenant.lastActivityAt)}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/admin/tenants/${tenant.key}`}
                            className="rounded-[var(--radius-md)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
                          >
                            Details
                          </Link>
                          {tenant.status !== "ARCHIVED" && (
                            <button
                              type="button"
                              onClick={() => handleArchive(tenant.key, tenant.name)}
                              disabled={archiving === tenant.key}
                              className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[0.75rem] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Archive className="h-3.5 w-3.5" />
                              Archivieren
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
