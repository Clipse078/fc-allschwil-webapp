"use client";

/**
 * PremiumWorkflowSteps — REG-WAIT-01F
 *
 * Canonical premium workflow/status card shared by Warteliste and Registrierungen.
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type PremiumWorkflowStepState = {
  key: string;
  label: string;
  timestamp?: string | null;
  state: "completed" | "current" | "future";
};

type Props = {
  statusLabel: string;
  statusBadgeClass: string;
  steps: PremiumWorkflowStepState[];
  nextStep: string;
  terminalAlert?: {
    title: string;
    detail?: React.ReactNode;
  } | null;
  formatTimestamp?: (iso: string | null | undefined) => string;
};

export function PremiumWorkflowSteps({
  statusLabel,
  statusBadgeClass,
  steps,
  nextStep,
  terminalAlert,
  formatTimestamp,
}: Props) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Workflow &amp; Status
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{statusLabel}</p>
        </div>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold",
            statusBadgeClass,
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-4">
        <ol className="flex flex-wrap items-start gap-y-3">
          {steps.map((step, index) => {
            const isCompleted = step.state === "completed";
            const isCurrent = step.state === "current";
            const isFuture = step.state === "future";
            const connectorActive =
              isCompleted ||
              isCurrent ||
              steps[index + 1]?.state === "completed" ||
              steps[index + 1]?.state === "current";

            return (
              <li key={step.key} className="relative flex min-w-[4.5rem] flex-1 flex-col items-center text-center">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-3 h-0.5 w-1/2 -translate-x-1/2",
                      isCompleted || isCurrent ? "bg-[var(--tenant-primary)]" : "bg-[var(--border)]",
                    )}
                  />
                ) : null}
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute right-0 top-3 h-0.5 w-1/2 translate-x-1/2",
                      connectorActive ? "bg-[var(--tenant-primary)]" : "bg-[var(--border)]",
                    )}
                  />
                ) : null}

                <div
                  className={cn(
                    "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[0.62rem] font-bold",
                    isCurrent
                      ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white shadow-[0_0_0_4px_rgba(11,74,162,0.12)]"
                      : isCompleted
                        ? "border-[var(--tenant-primary)] bg-[var(--surface)] text-[var(--tenant-primary)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
                  )}
                >
                  {isCompleted && !isCurrent ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </div>

                <p
                  className={cn(
                    "mt-2 px-1 text-[0.68rem] font-semibold leading-tight",
                    isCurrent
                      ? "text-[var(--tenant-primary)]"
                      : isFuture
                        ? "text-[var(--muted)]"
                        : "text-[var(--foreground)]",
                  )}
                >
                  {step.label}
                </p>
                {step.timestamp && formatTimestamp ? (
                  <p className="mt-0.5 px-1 text-[0.62rem] text-[var(--muted)]">
                    {formatTimestamp(step.timestamp)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {terminalAlert ? (
        <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" aria-hidden />
          <div>
            <p className="text-xs font-semibold text-rose-800">{terminalAlert.title}</p>
            {terminalAlert.detail}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Nächster Schritt
        </p>
        <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{nextStep}</p>
      </div>
    </div>
  );
}
