"use client";

/**
 * components/admin/planner/WeekplannerPlanCreateDialog.tsx
 *
 * WOCHENPLAN-2.0-01H-C — premium minimal dialog for creating a new tenant-level
 * WochenplanPlan with optional week materialization and copy semantics.
 */

import { useCallback, useId, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import type { WochenplanPlanDto } from "@/lib/wochenplan/plan-types";

export type WochenplanPlanCreateMode = "empty" | "copy";

type Props = {
  open: boolean;
  weekParam: string;
  wochenplanPlans: WochenplanPlanDto[];
  onClose: () => void;
  onCreated: (planId: string) => void;
};

export function WeekplannerPlanCreateDialog({
  open,
  weekParam,
  wochenplanPlans,
  onClose,
  onCreated,
}: Props) {
  const formId = useId();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<WochenplanPlanCreateMode>("empty");
  const [sourcePlanId, setSourcePlanId] = useState(
    () => wochenplanPlans.find((p) => p.isDefault)?.id ?? wochenplanPlans[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName("");
    setMode("empty");
    setSourcePlanId(wochenplanPlans.find((p) => p.isDefault)?.id ?? wochenplanPlans[0]?.id ?? "");
    setError(null);
  }, [wochenplanPlans]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Bitte einen Planname eingeben.");
      return;
    }
    if (mode === "copy" && !sourcePlanId) {
      setError("Bitte eine Vorlage auswählen.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/wochenplan/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            weekId: weekParam,
            mode,
            ...(mode === "copy" ? { sourceWochenplanPlanId: sourcePlanId } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          plan?: WochenplanPlanDto;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `Fehler: HTTP ${res.status}`);
        }
        if (!data.plan?.id) {
          throw new Error("Plan konnte nicht erstellt werden.");
        }
        onCreated(data.plan.id);
        reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
      }
    });
  }, [name, mode, sourcePlanId, weekParam, onCreated, reset]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Neuer Wochenplan"
      description="Erstellen Sie einen benannten Alternativplan für diese Kalenderwoche."
      size="md"
      footer={
        <>
          <button type="button" onClick={handleClose} className="fca-button-secondary text-sm">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            data-testid="weekplanner-plan-create-submit"
            className="fca-button-primary text-sm"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Erstellen…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Plan erstellen
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-5" data-testid="weekplanner-plan-create-dialog">
        <label className="block space-y-1.5" htmlFor={`${formId}-name`}>
          <span className="fca-label">Planname</span>
          <input
            id={`${formId}-name`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Schlechtwetterplan"
            autoFocus
            data-testid="weekplanner-plan-create-name"
            className="fca-input w-full"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="fca-label">Startpunkt</legend>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm hover:bg-[var(--surface-2)]">
            <input
              type="radio"
              name={`${formId}-mode`}
              value="empty"
              checked={mode === "empty"}
              onChange={() => setMode("empty")}
              data-testid="weekplanner-plan-create-mode-empty"
            />
            <span>Leer starten</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm hover:bg-[var(--surface-2)]">
            <input
              type="radio"
              name={`${formId}-mode`}
              value="copy"
              checked={mode === "copy"}
              onChange={() => setMode("copy")}
              data-testid="weekplanner-plan-create-mode-copy"
            />
            <span>Bestehenden Plan kopieren</span>
          </label>
        </fieldset>

        {mode === "copy" && (
          <label className="block space-y-1.5" htmlFor={`${formId}-source`}>
            <span className="fca-label">Vorlage</span>
            <select
              id={`${formId}-source`}
              value={sourcePlanId}
              onChange={(e) => setSourcePlanId(e.target.value)}
              data-testid="weekplanner-plan-create-source"
              className="fca-select w-full"
            >
              {wochenplanPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p className="text-sm text-rose-600" role="alert" data-testid="weekplanner-plan-create-error">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
