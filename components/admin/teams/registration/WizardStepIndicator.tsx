"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type WizardStep = {
  index: number;
  label: string;
  shortLabel?: string;
};

type Props = {
  steps: WizardStep[];
  currentStep: number;
  /** 0-based index of steps already completed */
  completedUpTo?: number;
};

/**
 * WizardStepIndicator
 *
 * Horizontal step indicator for the Team Registration wizard.
 * Shows the active step, completed steps (with checkmark), and future steps.
 * Fully keyboard-accessible; each step announces its state to screen readers.
 */
export default function WizardStepIndicator({
  steps,
  currentStep,
  completedUpTo = -1,
}: Props) {
  return (
    <nav
      aria-label="Registrierungsschritte"
      className="w-full"
    >
      <ol
        className="flex items-center"
        role="list"
      >
        {steps.map((step, index) => {
          const isCompleted = index <= completedUpTo;
          const isActive = index === currentStep;
          const isFuture = index > currentStep;

          return (
            <li
              key={step.index}
              className={cn(
                "flex items-center",
                index < steps.length - 1 && "flex-1",
              )}
              aria-current={isActive ? "step" : undefined}
            >
              {/* Step circle */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold shrink-0",
                    "transition-colors duration-150",
                    isCompleted &&
                      "bg-[var(--sce-primary)] text-white",
                    isActive &&
                      "border-2 border-[var(--sce-primary)] bg-[var(--surface)] text-[var(--sce-primary)]",
                    isFuture &&
                      "border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)]",
                  )}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{step.index + 1}</span>
                  )}
                </div>

                {/* Step label */}
                <span
                  className={cn(
                    "text-center text-xs font-medium leading-tight",
                    "hidden sm:block",
                    "max-w-[6rem]",
                    isActive && "text-[var(--sce-primary)]",
                    isCompleted && "text-[var(--foreground)]",
                    isFuture && "text-[var(--text-3)]",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-2 mb-5 h-px flex-1",
                    "hidden sm:block",
                    index < completedUpTo
                      ? "bg-[var(--sce-primary)]"
                      : "bg-[var(--border)]",
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: show current step label */}
      <p className="mt-2 text-center text-sm text-[var(--text-2)] sm:hidden">
        Schritt {currentStep + 1} von {steps.length}:{" "}
        <span className="font-semibold text-[var(--foreground)]">
          {steps[currentStep]?.label}
        </span>
      </p>
    </nav>
  );
}
