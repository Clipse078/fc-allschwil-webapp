"use client";

/**
 * components/admin/wochenplan/WochenplanPlanBar.tsx
 *
 * WOCHENPLAN-2.0-01B — tenant-level plan selector with view vs public/active
 * separation. Mirrors WeekplannerPlanBar patterns.
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Power, X } from "lucide-react";
import type { WochenplanPlanDto } from "@/lib/wochenplan/plan-types";

type Props = {
  weekParam: string;
  plans: WochenplanPlanDto[];
  viewedPlanId: string | null;
  canManage: boolean;
};

function buildWochenplanHref(weekParam: string, planId: string | null): string {
  const params = new URLSearchParams({ week: weekParam });
  if (planId) params.set("plan", planId);
  return `/dashboard/wochenplan?${params.toString()}`;
}

export default function WochenplanPlanBar({ weekParam, plans, viewedPlanId, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const viewedPlan = viewedPlanId ? plans.find((p) => p.id === viewedPlanId) ?? null : null;
  const selectedPlanId = viewedPlan?.id ?? plans.find((p) => p.isDefault)?.id ?? plans[0]?.id ?? null;
  const publicPlan = plans.find((p) => p.isActive) ?? null;

  const handleSelect = useCallback(
    (value: string) => {
      router.push(buildWochenplanHref(weekParam, value || null));
    },
    [router, weekParam],
  );

  const handleCreate = useCallback(() => {
    const name = newPlanName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/wochenplan/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        const data = (await res.json()) as { plan: WochenplanPlanDto };
        setIsCreating(false);
        setNewPlanName("");
        router.push(buildWochenplanHref(weekParam, data.plan.id));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
      }
    });
  }, [newPlanName, weekParam, router]);

  const handleRename = useCallback(() => {
    if (!viewedPlan) return;
    const name = renameValue.trim();
    if (!name || name === viewedPlan.name) {
      setIsRenaming(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/wochenplan/plans/${viewedPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        setIsRenaming(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Umbenennen");
      }
    });
  }, [viewedPlan, renameValue, router]);

  const handleActivate = useCallback(() => {
    if (!viewedPlan) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/wochenplan/plans/${viewedPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Aktivieren");
      }
    });
  }, [viewedPlan, router]);

  if (plans.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="wochenplan-plan-bar">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="wochenplan-plan-select" className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Plan
        </label>

        <select
          id="wochenplan-plan-select"
          data-testid="wochenplan-plan-select"
          value={selectedPlanId ?? ""}
          onChange={(e) => handleSelect(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
              {plan.isActive ? " (öffentlich)" : ""}
            </option>
          ))}
        </select>

        {canManage && !isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            data-testid="wochenplan-plan-create-button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Plan erstellen
          </button>
        )}

        {canManage && viewedPlan && !isRenaming && (
          <>
            <button
              type="button"
              onClick={() => {
                setRenameValue(viewedPlan.name);
                setIsRenaming(true);
              }}
              data-testid="wochenplan-plan-rename-button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
            >
              <Pencil className="h-3 w-3" />
              Umbenennen
            </button>
            {!viewedPlan.isActive && (
              <button
                type="button"
                onClick={() => startTransition(handleActivate)}
                disabled={isPending}
                data-testid="wochenplan-plan-activate-button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <Power className="h-3 w-3" />
                Als öffentlichen Plan aktivieren
              </button>
            )}
          </>
        )}
      </div>

      {isCreating && (
        <div className="flex flex-wrap items-center gap-2" data-testid="wochenplan-plan-create-form">
          <input
            type="text"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            placeholder="Planname eingeben"
            data-testid="wochenplan-plan-create-input"
            autoFocus
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => startTransition(handleCreate)}
            disabled={isPending || !newPlanName.trim()}
            data-testid="wochenplan-plan-create-submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sce-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Erstellen
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setNewPlanName("");
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            <X className="h-3.5 w-3.5" />
            Abbrechen
          </button>
        </div>
      )}

      {isRenaming && viewedPlan && (
        <div className="flex flex-wrap items-center gap-2" data-testid="wochenplan-plan-rename-form">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            data-testid="wochenplan-plan-rename-input"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => startTransition(handleRename)}
            disabled={isPending || !renameValue.trim()}
            data-testid="wochenplan-plan-rename-submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sce-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Speichern
          </button>
          <button
            type="button"
            onClick={() => setIsRenaming(false)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            <X className="h-3.5 w-3.5" />
            Abbrechen
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600" role="alert" data-testid="wochenplan-plan-bar-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
          data-testid="wochenplan-public-plan-banner"
        >
          Öffentlicher Plan · {publicPlan?.name ?? "—"}
        </div>
        {viewedPlan && viewedPlan.id !== publicPlan?.id && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
            data-testid="wochenplan-viewed-plan-banner"
          >
            Ansicht · {viewedPlan.name}
          </div>
        )}
      </div>
    </div>
  );
}
