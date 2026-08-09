"use client";

/**
 * components/admin/planner/WeekplannerPlanBar.tsx
 *
 * WEEKPLANNER-01B — plan selector + "+ Plan erstellen" + minimal plan
 * management (rename / archive / delete-where-safe), per the product
 * spec's example:
 *
 *   Plan:
 *   [ Standardplan ▼ ]
 *     Standardplan
 *     Schlechtwetterplan
 *     + Plan erstellen
 *
 * Fully generic — no plan name is ever hardcoded here.
 *
 * WEEKPLANNER-01E — adds the OPERATIONAL activation status/action, fully
 * independent of `activePlanId` (which is only the admin VIEW selection —
 * `?plan=<id>` never implicitly activates a plan). The operational banner
 * always reflects `plans.find((p) => p.isActive)` (null == Standardplan
 * operationally active); activation/deactivation is only offered while
 * viewing that same alternative plan, as an explicit action.
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Loader2, Pencil, Plus, Power, PowerOff, Trash2, X } from "lucide-react";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";

const STANDARDPLAN_VALUE = "";

type Props = {
  weekParam: string;
  plans: WeekplannerPlanDto[];
  activePlanId: string | null;
  canManage: boolean;
};

function buildWeekplannerHref(weekParam: string, planId: string | null): string {
  const params = new URLSearchParams({ week: weekParam });
  if (planId) params.set("plan", planId);
  return `/dashboard/planner/week?${params.toString()}`;
}

export function WeekplannerPlanBar({ weekParam, plans, activePlanId, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const activePlan = activePlanId ? plans.find((p) => p.id === activePlanId) ?? null : null;

  // WEEKPLANNER-01E — the OPERATIONALLY active plan (or null == Standardplan
  // operationally active). Deliberately independent of `activePlan` above
  // (the admin VIEW selection) — viewing a plan never activates it.
  const operationalPlan = plans.find((p) => p.isActive) ?? null;

  const handleSelect = useCallback(
    (value: string) => {
      router.push(buildWeekplannerHref(weekParam, value || null));
    },
    [router, weekParam],
  );

  const handleCreate = useCallback(() => {
    const name = newPlanName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/weekplanner/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekId: weekParam, name }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        const data = (await res.json()) as { plan: WeekplannerPlanDto };
        setIsCreating(false);
        setNewPlanName("");
        router.push(buildWeekplannerHref(weekParam, data.plan.id));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
      }
    });
  }, [newPlanName, weekParam, router]);

  const handleRename = useCallback(() => {
    if (!activePlan) return;
    const name = renameValue.trim();
    if (!name || name === activePlan.name) {
      setIsRenaming(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/weekplanner/plans/${activePlan.id}`, {
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
  }, [activePlan, renameValue, router]);

  const handleArchive = useCallback(() => {
    if (!activePlan) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/weekplanner/plans/${activePlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        router.push(buildWeekplannerHref(weekParam, null));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Archivieren");
      }
    });
  }, [activePlan, weekParam, router]);

  const handleActivate = useCallback(() => {
    if (!activePlan) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/weekplanner/plans/${activePlan.id}`, {
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
  }, [activePlan, router]);

  const handleDeactivate = useCallback(() => {
    if (!activePlan) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/weekplanner/plans/${activePlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: false }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Deaktivieren");
      }
    });
  }, [activePlan, router]);

  const handleDelete = useCallback(() => {
    if (!activePlan) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/weekplanner/plans/${activePlan.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        router.push(buildWeekplannerHref(weekParam, null));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Löschen");
      }
    });
  }, [activePlan, weekParam, router]);

  return (
    <div className="space-y-2" data-testid="weekplanner-plan-bar">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="weekplanner-plan-select" className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Plan
        </label>

        <select
          id="weekplanner-plan-select"
          data-testid="weekplanner-plan-select"
          value={activePlanId ?? STANDARDPLAN_VALUE}
          onChange={(e) => handleSelect(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
        >
          <option value={STANDARDPLAN_VALUE}>Standardplan</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>

        {canManage && !isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            data-testid="weekplanner-plan-create-button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Plan erstellen
          </button>
        )}

        {canManage && activePlan && !isRenaming && (
          <>
            <button
              type="button"
              onClick={() => {
                setRenameValue(activePlan.name);
                setIsRenaming(true);
              }}
              data-testid="weekplanner-plan-rename-button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
            >
              <Pencil className="h-3 w-3" />
              Umbenennen
            </button>
            {activePlan.isActive ? (
              <button
                type="button"
                onClick={() => startTransition(handleDeactivate)}
                disabled={isPending}
                data-testid="weekplanner-plan-deactivate-button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <PowerOff className="h-3 w-3" />
                Betriebsplan deaktivieren
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startTransition(handleActivate)}
                disabled={isPending}
                data-testid="weekplanner-plan-activate-button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <Power className="h-3 w-3" />
                Als Betriebsplan aktivieren
              </button>
            )}
            <button
              type="button"
              onClick={() => startTransition(handleArchive)}
              disabled={isPending}
              data-testid="weekplanner-plan-archive-button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              <Archive className="h-3 w-3" />
              Archivieren
            </button>
            <button
              type="button"
              onClick={() => startTransition(handleDelete)}
              disabled={isPending}
              data-testid="weekplanner-plan-delete-button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              title="Nur möglich, wenn der Plan keine Ressourcen-Overrides enthält"
            >
              <Trash2 className="h-3 w-3" />
              Löschen
            </button>
          </>
        )}
      </div>

      {isCreating && (
        <div className="flex flex-wrap items-center gap-2" data-testid="weekplanner-plan-create-form">
          <input
            type="text"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            placeholder="z. B. Schlechtwetterplan"
            data-testid="weekplanner-plan-create-input"
            autoFocus
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => startTransition(handleCreate)}
            disabled={isPending || !newPlanName.trim()}
            data-testid="weekplanner-plan-create-submit"
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

      {isRenaming && activePlan && (
        <div className="flex flex-wrap items-center gap-2" data-testid="weekplanner-plan-rename-form">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            data-testid="weekplanner-plan-rename-input"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => startTransition(handleRename)}
            disabled={isPending || !renameValue.trim()}
            data-testid="weekplanner-plan-rename-submit"
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
        <p className="text-xs text-rose-600" role="alert" data-testid="weekplanner-plan-bar-error">
          {error}
        </p>
      )}

      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
        data-testid="weekplanner-operational-plan-banner"
      >
        Betriebsplan · {operationalPlan ? operationalPlan.name : "Standardplan"}
      </div>

      {activePlan && (
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
          data-testid="weekplanner-active-plan-banner"
        >
          Ansicht · {activePlan.name}
        </div>
      )}
    </div>
  );
}
