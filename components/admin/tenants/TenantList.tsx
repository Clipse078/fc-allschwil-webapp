"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Search } from "lucide-react";

type TenantItem = {
  id: string;
  key: string;
  name: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type TenantListProps = {
  tenants: TenantItem[];
  canManage: boolean;
};

function TenantStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ACTIVE: { label: "Aktiv", bg: "rgba(16,185,129,0.12)", color: "#10b981" },
    INACTIVE: { label: "Inaktiv", bg: "rgba(156,163,175,0.12)", color: "var(--muted)" },
    ARCHIVED: { label: "Archiviert", bg: "rgba(239,68,68,0.08)", color: "#ef4444" },
  };
  const cfg = map[status] ?? { label: status, bg: "var(--surface-3)", color: "var(--muted)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

export default function TenantList({ tenants, canManage }: TenantListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [archiving, setArchiving] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = tenants.filter((t) => {
    const q = query.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q);
  });

  async function handleArchive(tenantKey: string, tenantName: string) {
    if (!confirm(`Tenant "${tenantName}" archivieren? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    setArchiving(tenantKey);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantKey}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setArchiveError(data?.error ?? "Archivierung fehlgeschlagen.");
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setArchiveError("Netzwerkfehler beim Archivieren.");
    } finally {
      setArchiving(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="sce-page-search">
        <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tenant suchen…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
        />
      </div>

      {archiveError && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {archiveError}
        </div>
      )}

      {/* Table */}
      <div className="sce-detail-section overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm font-medium text-[var(--text-2)]">
              {query ? "Keine Tenants gefunden." : "Noch keine Tenants angelegt."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Name
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Key
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Status
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
                    <Link
                      href={`/dashboard/admin/tenants/${tenant.key}`}
                      className="font-medium text-[var(--foreground)] hover:text-[var(--blue)] hover:underline"
                    >
                      {tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[0.75rem] text-[var(--text-2)]">
                      {tenant.key}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <TenantStatusBadge status={tenant.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/admin/tenants/${tenant.key}`}
                          className="rounded-[var(--radius-md)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
                        >
                          Bearbeiten
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
        )}
      </div>
    </div>
  );
}
