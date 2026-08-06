"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Search, ShieldCheck, User, X } from "lucide-react";
import ProtectedRoleBadge from "@/components/admin/roles/ProtectedRoleBadge";
import type { UserEffectiveAccessView } from "@/lib/roles/effective-access";

export type EffectiveAccessMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
};

type Props = {
  members: EffectiveAccessMember[];
};

/**
 * Read-only diagnostic view — every permission/module-visibility fact
 * rendered here comes straight from `GET /api/tenant/effective-access`,
 * which is itself a thin wrapper over `EffectivePermissionResolver`
 * (`lib/roles/effective-access.ts`). This component never computes
 * permissions itself.
 */
export default function EffectiveAccessViewer({ members }: Props) {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(members[0]?.userId ?? null);
  const [view, setView] = useState<UserEffectiveAccessView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, search]);

  async function loadView(userId: string) {
    setSelectedUserId(userId);
    setLoading(true);
    setError(null);
    setView(null);
    try {
      const res = await fetch(`/api/tenant/effective-access?userId=${encodeURIComponent(userId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Effektiver Zugriff konnte nicht geladen werden.");
        return;
      }
      setView(data.view);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-sm font-semibold text-[var(--foreground)]">Mitglied wählen</p>
        </div>
        <div className="sce-detail-section-body space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mitglied suchen…"
              className="fca-input w-full pl-9"
              aria-label="Mitglied suchen"
            />
          </div>
          <ul className="max-h-[480px] space-y-1 overflow-y-auto">
            {filteredMembers.map((member) => (
              <li key={member.userId}>
                <button
                  type="button"
                  onClick={() => loadView(member.userId)}
                  className={`flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors ${
                    member.userId === selectedUserId
                      ? "bg-[var(--blue-light)] text-[var(--blue)]"
                      : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.82rem] font-medium">
                      {member.firstName} {member.lastName}
                    </span>
                    <span className="block truncate text-[0.7rem] text-[var(--muted)]">{member.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Wird geladen…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <p className="text-[12px] font-medium text-rose-700">{error}</p>
          </div>
        )}

        {!loading && !error && view && (
          <>
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {view.user.firstName} {view.user.lastName}
                </p>
                {!view.membershipIsActive && (
                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[0.68rem] font-semibold text-rose-700">
                    Inaktive Mitgliedschaft
                  </span>
                )}
              </div>
              <div className="sce-detail-section-body space-y-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  Zugewiesene Rollen
                </p>
                {view.assignedRoles.length === 0 ? (
                  <p className="text-[0.82rem] text-[var(--muted)]">Keine Rollen zugewiesen.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {view.assignedRoles.map((role) => (
                      <li
                        key={role.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[0.78rem] font-medium text-[var(--text-2)]"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {role.name}
                        {role.isSystem && <ProtectedRoleBadge />}
                        {role.isArchived && (
                          <span className="text-[0.65rem] text-rose-600">(archiviert — ohne Wirkung)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {view.platformRoles.length > 0 && (
                  <>
                    <p className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                      Plattform-Rollen (separat, keine Mandanten-Wirkung)
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {view.platformRoles.map((role) => (
                        <li
                          key={role.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[0.78rem] font-medium text-[var(--text-2)]"
                        >
                          {role.name}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <p className="text-sm font-semibold text-[var(--foreground)]">Effektiver Zugriff</p>
              </div>
              <div className="sce-detail-section-body">
                {view.visibleNavItems.length === 0 && view.deniedNavItems.length === 0 ? (
                  <p className="text-[0.82rem] text-[var(--muted)]">Keine Modulinformationen verfügbar.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {view.visibleNavItems.map((item) => (
                      <li key={`visible:${item.href}`} className="flex items-center gap-2 text-[0.85rem]">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span className="text-[var(--foreground)]">{item.label}</span>
                      </li>
                    ))}
                    {view.deniedNavItems.map((item) => (
                      <li key={`denied:${item.href}`} className="flex items-center gap-2 text-[0.85rem]">
                        <X className="h-4 w-4 text-[var(--muted)]" />
                        <span className="text-[var(--muted)]">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
